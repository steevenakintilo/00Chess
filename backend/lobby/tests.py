from datetime import timedelta

from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from accounts.models import User

from .models import CODE_ALPHABET, CODE_LENGTH, FinishedGame, Room


def client_for(user: User) -> APIClient:
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client


class BaseRoomTest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice', 'secret1')
        self.bob = User.objects.create_user('bob', 'secret1')
        self.carl = User.objects.create_user('carl', 'secret1')
        self.a, self.b, self.c = client_for(self.alice), client_for(self.bob), client_for(self.carl)

    def start_game(self) -> str:
        code = self.a.post('/api/rooms/').data['code']
        self.b.post('/api/rooms/join/', {'code': code}, format='json')
        return code

    def state(self, client, code, after=0):
        return client.get(f'/api/rooms/{code}/state/?after={after}')

    def post(self, client, code, path, data=None):
        return client.post(f'/api/rooms/{code}/{path}/', data or {}, format='json')


class RoomTests(BaseRoomTest):
    def test_requires_login(self):
        self.assertEqual(self.client.post('/api/rooms/').status_code, 401)
        self.assertEqual(self.client.post('/api/rooms/join/', {'code': 'ABC234'}).status_code, 401)

    def test_create_returns_valid_code(self):
        res = self.a.post('/api/rooms/')
        self.assertEqual(res.status_code, 201)
        code = res.data['code']
        self.assertEqual(len(code), CODE_LENGTH)
        self.assertTrue(all(ch in CODE_ALPHABET for ch in code))
        self.assertEqual(res.data['host']['username'], 'alice')
        self.assertIsNone(res.data['guest'])
        self.assertEqual(res.data['phase'], 'lobby')

    def test_friend_joins_with_code_even_lowercase_and_game_starts(self):
        code = self.a.post('/api/rooms/').data['code']
        res = self.b.post('/api/rooms/join/', {'code': code.lower()}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['guest']['username'], 'bob')
        self.assertTrue(res.data['is_full'])
        self.assertEqual(res.data['phase'], 'duel')
        self.assertEqual(res.data['round'], 1)
        self.assertEqual(self.a.get(f'/api/rooms/{code}/').data['guest']['username'], 'bob')
        events = self.state(self.a, code).data['events']
        self.assertEqual([e['kind'] for e in events], ['start'])
        self.assertEqual(events[0]['payload'], {'host': 'alice', 'guest': 'bob', 'mode': 'winner', 'pace': 'blitz'})

    def test_join_errors(self):
        code = self.a.post('/api/rooms/').data['code']
        self.assertEqual(self.a.post('/api/rooms/join/', {'code': code}, format='json').status_code, 400)
        self.assertEqual(self.b.post('/api/rooms/join/', {'code': 'ZZZZZZ'}, format='json').status_code, 404)
        self.b.post('/api/rooms/join/', {'code': code}, format='json')
        self.assertEqual(self.c.post('/api/rooms/join/', {'code': code}, format='json').status_code, 409)

    def test_stranger_cannot_read_room_or_state(self):
        code = self.a.post('/api/rooms/').data['code']
        self.assertEqual(self.c.get(f'/api/rooms/{code}/').status_code, 404)
        self.assertEqual(self.state(self.c, code).status_code, 404)

    def test_host_closes_waiting_room(self):
        code = self.a.post('/api/rooms/').data['code']
        self.assertEqual(self.a.delete(f'/api/rooms/{code}/').status_code, 204)
        self.assertFalse(Room.objects.filter(code=code).exists())

    def test_new_room_replaces_previous_one_of_host(self):
        first = self.a.post('/api/rooms/').data['code']
        second = self.a.post('/api/rooms/').data['code']
        self.assertNotEqual(first, second)
        self.assertEqual(Room.objects.filter(host=self.alice).count(), 1)

    def test_inactive_room_is_gone(self):
        code = self.a.post('/api/rooms/').data['code']
        Room.objects.filter(code=code).update(updated_at=timezone.now() - timedelta(hours=2))
        self.assertEqual(self.b.post('/api/rooms/join/', {'code': code}, format='json').status_code, 404)


class GameFlowTests(BaseRoomTest):
    def test_moves_are_hidden_until_both_played_then_revealed(self):
        code = self.start_game()
        self.assertEqual(self.post(self.a, code, 'move', {'move': 'CHARGER'}).data, {'revealed': False})
        # l'adversaire sait que alice a joué, mais pas ce qu'elle a joué
        st = self.state(self.b, code).data
        self.assertTrue(st['opponent_move_sent'])
        self.assertFalse(st['my_move_sent'])
        self.assertNotIn('CHARGER', str(st['events']))
        self.assertEqual(self.post(self.b, code, 'move', {'move': 'BOUCLIER'}).data, {'revealed': True})
        events = self.state(self.a, code, after=1).data['events']
        self.assertEqual(events[0]['kind'], 'reveal')
        self.assertEqual(events[0]['payload'], {'round': 1, 'exchange': 1, 'host': 'CHARGER', 'guest': 'BOUCLIER'})
        self.assertEqual(self.state(self.a, code).data['room']['exchange'], 2)

    def test_move_errors(self):
        code = self.start_game()
        self.assertEqual(self.post(self.a, code, 'move', {'move': 'HACK'}).status_code, 400)
        self.post(self.a, code, 'move', {'move': 'CHARGER'})
        self.assertEqual(self.post(self.a, code, 'move', {'move': 'TIRER'}).status_code, 409)  # déjà joué
        self.assertEqual(self.post(self.c, code, 'move', {'move': 'CHARGER'}).status_code, 404)  # étranger

    def test_duel_result_needs_agreement_then_winner_acts(self):
        code = self.start_game()
        self.assertEqual(self.post(self.a, code, 'duel-result', {'round': 1, 'outcome': 'host'}).data['verdict'], 'waiting')
        self.assertEqual(self.post(self.b, code, 'duel-result', {'round': 1, 'outcome': 'host'}).data['verdict'], 'agreed')
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['actor']), ('action', 'host'))
        # seul le gagnant peut jouer
        self.assertEqual(self.post(self.b, code, 'action', {'action': {'kind': 'pass'}}).status_code, 409)
        self.assertEqual(self.post(self.a, code, 'action', {'action': {'kind': 'rm -rf'}}).status_code, 400)
        self.assertEqual(self.post(self.a, code, 'action', {'action': {'kind': 'pass'}}).status_code, 204)
        room = self.state(self.b, code).data['room']
        self.assertEqual((room['phase'], room['round'], room['exchange'], room['actor']), ('duel', 2, 1, None))
        kinds = [e['kind'] for e in self.state(self.b, code).data['events']]
        self.assertEqual(kinds, ['start', 'duel_end', 'action'])

    def test_draw_goes_straight_to_next_round(self):
        code = self.start_game()
        self.post(self.a, code, 'duel-result', {'round': 1, 'outcome': 'draw'})
        self.post(self.b, code, 'duel-result', {'round': 1, 'outcome': 'draw'})
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['round']), ('duel', 2))

    def test_disagreement_aborts_game(self):
        code = self.start_game()
        self.post(self.a, code, 'duel-result', {'round': 1, 'outcome': 'host'})
        self.assertEqual(self.post(self.b, code, 'duel-result', {'round': 1, 'outcome': 'guest'}).data['verdict'], 'mismatch')
        st = self.state(self.a, code).data
        self.assertEqual(st['room']['phase'], 'over')
        self.assertEqual(st['events'][-1]['kind'], 'desync')

    def test_game_over_needs_both_players(self):
        code = self.start_game()
        report = {'winner': 'guest', 'hp_host': 0, 'hp_guest': 5}
        self.post(self.a, code, 'game-over', report)
        self.assertEqual(self.state(self.a, code).data['room']['phase'], 'duel')
        self.post(self.b, code, 'game-over', report)
        st = self.state(self.a, code).data
        self.assertEqual(st['room']['phase'], 'over')
        last = st['events'][-1]
        self.assertEqual(last['kind'], 'game_over')
        self.assertEqual(last['payload']['winner'], 'guest')
        self.assertEqual(last['payload']['hp'], {'host': 0, 'guest': 5})
        # plus aucun coup après la fin
        self.assertEqual(self.post(self.a, code, 'move', {'move': 'CHARGER'}).status_code, 409)

    def test_leaving_mid_game_is_a_forfeit(self):
        code = self.start_game()
        self.assertEqual(self.b.delete(f'/api/rooms/{code}/').status_code, 204)
        st = self.state(self.a, code).data
        self.assertEqual(st['room']['phase'], 'over')
        self.assertEqual(st['events'][-1]['payload']['side'], 'guest')
        # la salle disparaît quand quelqu'un la quitte après la fin
        self.assertEqual(self.a.delete(f'/api/rooms/{code}/').status_code, 204)
        self.assertEqual(self.state(self.a, code).status_code, 404)

    def test_claim_victory_only_after_silence(self):
        code = self.start_game()
        self.state(self.b, code)  # bob vient de donner des nouvelles
        self.assertEqual(self.post(self.a, code, 'claim').status_code, 409)
        Room.objects.filter(code=code).update(guest_seen=timezone.now() - timedelta(seconds=60))
        self.assertEqual(self.post(self.a, code, 'claim').status_code, 204)
        self.assertEqual(self.state(self.a, code).data['events'][-1]['payload']['side'], 'guest')

    def test_events_are_incremental(self):
        code = self.start_game()
        self.post(self.a, code, 'move', {'move': 'CHARGER'})
        self.post(self.b, code, 'move', {'move': 'CHARGER'})
        self.assertEqual(len(self.state(self.a, code).data['events']), 2)
        self.assertEqual(self.state(self.a, code, after=2).data['events'], [])


class TurnsModeTests(BaseRoomTest):
    """Mode « tour par tour » : les deux joueurs jouent à chaque round, le premier change à chaque round."""

    def start_turns(self) -> str:
        code = self.a.post('/api/rooms/', {'mode': 'turns'}, format='json').data['code']
        self.b.post('/api/rooms/join/', {'code': code}, format='json')
        return code

    def agree_duel(self, code, rnd, outcome):
        self.post(self.a, code, 'duel-result', {'round': rnd, 'outcome': outcome})
        return self.post(self.b, code, 'duel-result', {'round': rnd, 'outcome': outcome})

    def test_default_mode_is_winner_and_invalid_mode_is_rejected(self):
        res = self.a.post('/api/rooms/')
        self.assertEqual(res.data['mode'], 'winner')
        self.assertEqual(self.a.post('/api/rooms/', {'mode': 'zzz'}, format='json').status_code, 400)

    def test_start_event_carries_the_mode(self):
        code = self.start_turns()
        events = self.state(self.a, code).data['events']
        self.assertEqual(events[0]['payload'], {'host': 'alice', 'guest': 'bob', 'mode': 'turns', 'pace': 'blitz'})
        self.assertEqual(self.state(self.b, code).data['room']['mode'], 'turns')

    def test_both_act_each_round_and_first_player_alternates(self):
        code = self.start_turns()
        self.agree_duel(code, 1, 'guest')  # même si l'invité gagne le duel, l'hôte joue en premier au round 1
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['actor']), ('action', 'host'))
        duel_end = [e for e in self.state(self.a, code).data['events'] if e['kind'] == 'duel_end'][0]
        self.assertEqual(duel_end['payload']['actors'], ['host', 'guest'])
        # l'invité doit attendre son tour
        self.assertEqual(self.post(self.b, code, 'action', {'action': {'kind': 'pass'}}).status_code, 409)
        self.assertEqual(self.post(self.a, code, 'action', {'action': {'kind': 'pass'}}).status_code, 204)
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['actor'], room['round']), ('action', 'guest', 1))
        self.assertEqual(self.post(self.a, code, 'action', {'action': {'kind': 'pass'}}).status_code, 409)
        self.assertEqual(self.post(self.b, code, 'action', {'action': {'kind': 'pass'}}).status_code, 204)
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['actor'], room['round'], room['exchange']), ('duel', None, 2, 1))
        # round 2 : le duel est nul, mais les deux jouent quand même, l'invité en premier
        self.agree_duel(code, 2, 'draw')
        room = self.state(self.a, code).data['room']
        self.assertEqual((room['phase'], room['actor']), ('action', 'guest'))
        kinds = [e['kind'] for e in self.state(self.a, code).data['events']]
        self.assertEqual(kinds, ['start', 'duel_end', 'action', 'action', 'duel_end'])

    def test_winner_mode_is_unchanged(self):
        code = self.start_game()
        self.post(self.a, code, 'duel-result', {'round': 1, 'outcome': 'guest'})
        self.post(self.b, code, 'duel-result', {'round': 1, 'outcome': 'guest'})
        duel_end = [e for e in self.state(self.a, code).data['events'] if e['kind'] == 'duel_end'][0]
        self.assertEqual(duel_end['payload']['actors'], ['guest'])
        self.assertEqual(self.post(self.b, code, 'action', {'action': {'kind': 'pass'}}).status_code, 204)
        self.assertEqual(self.state(self.a, code).data['room']['round'], 2)


class TrophyAndReplayTests(BaseRoomTest):
    def finish(self, winner, hp_host, hp_guest):
        code = self.start_game()
        report = {'winner': winner, 'hp_host': hp_host, 'hp_guest': hp_guest}
        self.post(self.a, code, 'game-over', report)
        self.post(self.b, code, 'game-over', report)
        return code

    def trophies(self):
        self.alice.refresh_from_db()
        self.bob.refresh_from_db()
        return self.alice.trophies, self.bob.trophies

    def test_trophies_are_the_hp_gap_times_ten(self):
        self.alice.trophies = self.bob.trophies = 100
        self.alice.save()
        self.bob.save()
        self.finish('host', 5, 0)  # 5-0
        self.assertEqual(self.trophies(), (150, 50))
        self.finish('guest', 0, 1)  # 5-4 pour bob
        self.assertEqual(self.trophies(), (140, 60))

    def test_draw_gives_nothing_and_trophies_never_go_below_zero(self):
        self.alice.trophies = 7
        self.alice.save()
        self.finish('draw', 3, 3)
        self.assertEqual(self.trophies(), (7, 0))
        self.finish('guest', 0, 5)
        self.assertEqual(self.trophies(), (0, 50))

    def test_winner_on_tiebreak_still_gains_the_minimum(self):
        self.alice.trophies = self.bob.trophies = 50
        self.alice.save()
        self.bob.save()
        self.finish('host', 2, 2)
        self.assertEqual(self.trophies(), (60, 40))

    def test_forfeit_costs_the_leaver(self):
        self.alice.trophies = self.bob.trophies = 80
        self.alice.save()
        self.bob.save()
        code = self.start_game()
        self.post(self.b, code, 'forfeit')
        self.assertEqual(self.trophies(), (90, 30))

    def test_game_over_needs_valid_hp(self):
        code = self.start_game()
        self.assertEqual(self.post(self.a, code, 'game-over', {'winner': 'host'}).status_code, 400)
        self.assertEqual(self.post(self.a, code, 'game-over', {'winner': 'host', 'hp_host': 9, 'hp_guest': 0}).status_code, 400)

    def test_disagreeing_hp_aborts_without_trophies(self):
        code = self.start_game()
        self.post(self.a, code, 'game-over', {'winner': 'host', 'hp_host': 5, 'hp_guest': 0})
        self.assertEqual(self.post(self.b, code, 'game-over', {'winner': 'host', 'hp_host': 5, 'hp_guest': 4}).data['verdict'], 'mismatch')
        self.assertEqual(self.trophies(), (0, 0))

    def test_finished_game_can_be_replayed_with_its_code(self):
        code = self.finish('host', 5, 0)
        last = self.state(self.a, code).data['events'][-1]['payload']
        res = self.client.get(f"/api/replays/{last['replay'].lower()}/")  # public, sans connexion
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.data['host'], res.data['guest']), ('alice', 'bob'))
        self.assertEqual(res.data['events'][0]['kind'], 'start')
        self.assertEqual(res.data['events'][-1]['kind'], 'game_over')
        self.assertEqual(res.data['trophies'], {'host': 50, 'guest': 0})
        # la partie reste revoyable même quand la salle est fermée
        self.a.delete(f'/api/rooms/{code}/')
        self.assertEqual(self.client.get(f"/api/replays/{last['replay']}/").status_code, 200)
        self.assertEqual(self.client.get('/api/replays/ZZZZZZ/').status_code, 404)

    def test_desync_is_not_archived(self):
        code = self.start_game()
        self.post(self.a, code, 'game-over', {'winner': 'host', 'hp_host': 5, 'hp_guest': 0})
        self.post(self.b, code, 'game-over', {'winner': 'guest', 'hp_host': 0, 'hp_guest': 5})
        self.assertEqual(FinishedGame.objects.count(), 0)

    def test_my_replays_lists_only_my_games(self):
        self.finish('host', 5, 0)
        self.assertEqual(len(self.a.get('/api/replays/').data), 1)
        self.assertEqual(len(self.b.get('/api/replays/').data), 1)
        self.assertEqual(len(self.c.get('/api/replays/').data), 0)
