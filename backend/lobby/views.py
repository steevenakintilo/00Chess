from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from accounts.serializers import UserSerializer

from .models import DISCONNECT_AFTER, GAME_MODES, MOVES_007, PACES, ROOM_LIFETIME, GameEvent, Move007, Room

ACTION_KINDS = {'pass', 'buy', 'move', 'kamikaze', 'snipe', 'swap'}


class RoomThrottle(ScopedRateThrottle):
    scope = 'rooms'


class GameThrottle(ScopedRateThrottle):
    scope = 'game'


def _err(code: str, http_status: int) -> Response:
    return Response({'detail': code}, status=http_status)


def _room_data(room: Room) -> dict:
    return {
        'code': room.code,
        'host': UserSerializer(room.host).data,
        'guest': UserSerializer(room.guest).data if room.guest else None,
        'is_full': room.is_full,
        'phase': room.phase,
        'round': room.round,
        'exchange': room.exchange,
        'actor': room.actor,
        'mode': room.mode,
        'pace': room.pace,
    }


def _purge_expired() -> None:
    Room.objects.filter(updated_at__lt=timezone.now() - ROOM_LIFETIME).delete()


def _add_event(room: Room, kind: str, payload: dict) -> None:
    """Ajoute un événement public numéroté (la salle doit être verrouillée par l'appelant)."""
    room.last_seq += 1
    GameEvent.objects.create(room=room, seq=room.last_seq, kind=kind, payload=payload)


def _end(room: Room, kind: str, payload: dict) -> None:
    _add_event(room, kind, payload)
    room.phase = Room.PHASE_OVER
    room.actor = None


def _locked(user, code):
    """Salle verrouillée pour modification + camp du joueur ; (None, None) si elle n'existe pas ou n'est pas à lui."""
    room = Room.objects.select_for_update().select_related('host', 'guest').filter(code=str(code).upper()).first()
    if room is None or room.side_of(user) is None:
        return None, None
    return room, room.side_of(user)


def _not_found() -> Response:
    return _err('room_not_found', status.HTTP_404_NOT_FOUND)


# ----------------------------------------------------------------------------- salles


@api_view(['POST'])
@throttle_classes([RoomThrottle])
def create_room(request):
    """Crée une salle et renvoie son code (l'éventuelle ancienne salle de l'hôte est fermée)."""
    _purge_expired()
    mode = str(request.data.get('mode', 'winner'))
    if mode not in GAME_MODES:
        return _err('invalid_mode', status.HTTP_400_BAD_REQUEST)
    pace = str(request.data.get('pace', 'blitz'))
    if pace not in PACES:
        return _err('invalid_pace', status.HTTP_400_BAD_REQUEST)
    Room.objects.filter(host=request.user).delete()
    room = Room.objects.create(host=request.user, mode=mode, pace=pace)
    return Response(_room_data(room), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@throttle_classes([RoomThrottle])
def join_room(request):
    """Rejoint une salle avec le code donné par l'ami : la partie démarre aussitôt."""
    _purge_expired()
    code = str(request.data.get('code', '')).strip().upper()
    with transaction.atomic():
        room = Room.objects.select_for_update().select_related('host', 'guest').filter(code=code).first()
        if room is None:
            return _not_found()
        if room.host_id == request.user.id:
            return _err('own_room', status.HTTP_400_BAD_REQUEST)
        if room.guest_id == request.user.id:
            return Response(_room_data(room))  # déjà dedans : on renvoie simplement la salle
        if room.is_full:
            return _err('room_full', status.HTTP_409_CONFLICT)
        room.guest = request.user
        room.phase = Room.PHASE_DUEL
        room.round = 1
        room.exchange = 1
        room.updated_at = timezone.now()
        _add_event(room, 'start', {'host': room.host.username, 'guest': request.user.username, 'mode': room.mode, 'pace': room.pace})
        room.save()
    return Response(_room_data(room))


@api_view(['GET', 'DELETE'])
@throttle_classes([RoomThrottle])
def room_detail(request, code):
    """GET : état simple de la salle. DELETE : quitter (en pleine partie, c'est un abandon)."""
    _purge_expired()
    if request.method == 'GET':
        room = Room.objects.select_related('host', 'guest').filter(code=code.upper()).first()
        if room is None or room.side_of(request.user) is None:
            return _not_found()
        return Response(_room_data(room))

    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase in (Room.PHASE_DUEL, Room.PHASE_ACTION):
            _end(room, 'forfeit', {'side': side})
            room.updated_at = timezone.now()
            room.save()
        else:
            room.delete()  # salle d'attente ou partie finie : on la ferme
    return Response(status=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------------------- partie


@api_view(['GET'])
@throttle_classes([GameThrottle])
def room_state(request, code):
    """Interrogé en boucle par les deux joueurs : état de la salle + événements publics depuis `after`."""
    _purge_expired()
    room = Room.objects.select_related('host', 'guest').filter(code=code.upper()).first()
    if room is None or room.side_of(request.user) is None:
        return _not_found()
    side = room.side_of(request.user)
    other = 'guest' if side == 'host' else 'host'
    now = timezone.now()
    Room.objects.filter(pk=room.pk).update(**{f'{side}_seen': now, 'updated_at': now})

    try:
        after = max(int(request.query_params.get('after', 0)), 0)
    except ValueError:
        after = 0
    events = [{'seq': e.seq, 'kind': e.kind, 'payload': e.payload} for e in room.events.filter(seq__gt=after)]

    current = Move007.objects.filter(room=room, round=room.round, exchange=room.exchange)
    in_duel = room.phase == Room.PHASE_DUEL
    other_seen = getattr(room, f'{other}_seen')
    return Response(
        {
            'room': _room_data(room),
            'side': side,
            'events': events,
            'my_move_sent': in_duel and current.filter(side=side).exists(),
            'opponent_move_sent': in_duel and current.filter(side=other).exists(),
            'opponent_seen_ago': None if other_seen is None else int((now - other_seen).total_seconds()),
        }
    )


@api_view(['POST'])
@throttle_classes([GameThrottle])
def send_move(request, code):
    """Un joueur choisit son coup de 007. Il reste secret jusqu'à ce que l'autre ait joué aussi."""
    move = str(request.data.get('move', ''))
    if move not in MOVES_007:
        return _err('invalid_move', status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase != Room.PHASE_DUEL:
            return _err('wrong_phase', status.HTTP_409_CONFLICT)
        if Move007.objects.filter(room=room, round=room.round, exchange=room.exchange, side=side).exists():
            return _err('already_played', status.HTTP_409_CONFLICT)
        Move007.objects.create(room=room, round=room.round, exchange=room.exchange, side=side, move=move)
        revealed = False
        moves = {m.side: m.move for m in Move007.objects.filter(room=room, round=room.round, exchange=room.exchange)}
        if len(moves) == 2:
            _add_event(
                room,
                'reveal',
                {'round': room.round, 'exchange': room.exchange, 'host': moves['host'], 'guest': moves['guest']},
            )
            room.exchange += 1
            revealed = True
        room.updated_at = timezone.now()
        room.save()
    return Response({'revealed': revealed})


def _agree(room: Room, key: str, side: str, value) -> str:
    """Enregistre le compte rendu d'un joueur. Retourne 'waiting', 'agreed' ou 'mismatch'."""
    reports = room.reports.setdefault(key, {})
    reports[side] = value
    if len(reports) < 2:
        return 'waiting'
    return 'agreed' if reports['host'] == reports['guest'] else 'mismatch'


def _actors_after_duel(room: Room, outcome: str) -> list[str]:
    """Qui joue sur le plateau après le duel, dans l'ordre (les clients rejouent exactement cette liste)."""
    if room.mode == 'turns':
        first = 'host' if room.round % 2 == 1 else 'guest'  # le premier change à chaque round
        return [first, 'guest' if first == 'host' else 'host']
    return [] if outcome == 'draw' else [outcome]


def _desync(room: Room) -> None:
    _end(room, 'desync', {})


@api_view(['POST'])
@throttle_classes([GameThrottle])
def duel_result(request, code):
    """Chaque joueur annonce qui a gagné le duel (calculé chez lui) ; le serveur exige qu'ils soient d'accord."""
    outcome = str(request.data.get('outcome', ''))
    try:
        rnd = int(request.data.get('round'))
    except (TypeError, ValueError):
        return _err('invalid_report', status.HTTP_400_BAD_REQUEST)
    if outcome not in ('host', 'guest', 'draw'):
        return _err('invalid_report', status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase != Room.PHASE_DUEL or rnd != room.round:
            return _err('wrong_phase', status.HTTP_409_CONFLICT)
        verdict = _agree(room, 'duel', side, {'round': rnd, 'outcome': outcome})
        if verdict == 'mismatch':
            _desync(room)
        elif verdict == 'agreed':
            actors = _actors_after_duel(room, outcome)
            _add_event(room, 'duel_end', {'round': rnd, 'outcome': outcome, 'actors': actors})
            room.reports['duel'] = {}
            if actors:
                room.phase = Room.PHASE_ACTION
                room.actor = actors[0]
                room.pending = actors[1:]
            else:
                room.round += 1
                room.exchange = 1
        room.updated_at = timezone.now()
        room.save()
    return Response({'verdict': verdict})


@api_view(['POST'])
@throttle_classes([GameThrottle])
def send_action(request, code):
    """Le gagnant du duel joue son action sur le plateau (acheter, déplacer, sniper, swap, suicide ou passer)."""
    action = request.data.get('action')
    if not isinstance(action, dict) or action.get('kind') not in ACTION_KINDS:
        return _err('invalid_action', status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase != Room.PHASE_ACTION or room.actor != side:
            return _err('wrong_phase', status.HTTP_409_CONFLICT)
        _add_event(room, 'action', {'round': room.round, 'side': side, 'action': action})
        if room.pending:
            # tour par tour : c'est ensuite à l'autre joueur, dans le même round
            room.actor = room.pending[0]
            room.pending = room.pending[1:]
            room.updated_at = timezone.now()
            room.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        room.phase = Room.PHASE_DUEL
        room.actor = None
        room.round += 1
        room.exchange = 1
        room.reports = {}
        room.updated_at = timezone.now()
        room.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@throttle_classes([GameThrottle])
def game_over(request, code):
    """Chaque joueur annonce le résultat final (calculé chez lui) ; le serveur exige qu'ils soient d'accord."""
    winner = str(request.data.get('winner', ''))
    if winner not in ('host', 'guest', 'draw'):
        return _err('invalid_report', status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase == Room.PHASE_OVER:
            return Response({'verdict': 'done'})
        if room.phase == Room.PHASE_LOBBY:
            return _err('wrong_phase', status.HTTP_409_CONFLICT)
        verdict = _agree(room, 'over', side, winner)
        if verdict == 'mismatch':
            _desync(room)
        elif verdict == 'agreed':
            _end(room, 'game_over', {'winner': winner})
        room.updated_at = timezone.now()
        room.save()
    return Response({'verdict': verdict})


@api_view(['POST'])
@throttle_classes([GameThrottle])
def forfeit(request, code):
    """Abandonner la partie."""
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase in (Room.PHASE_DUEL, Room.PHASE_ACTION):
            _end(room, 'forfeit', {'side': side})
            room.updated_at = timezone.now()
            room.save()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@throttle_classes([GameThrottle])
def claim_victory(request, code):
    """Réclame la victoire si l'adversaire ne donne plus de nouvelles depuis trop longtemps."""
    with transaction.atomic():
        room, side = _locked(request.user, code)
        if room is None:
            return _not_found()
        if room.phase not in (Room.PHASE_DUEL, Room.PHASE_ACTION):
            return _err('wrong_phase', status.HTTP_409_CONFLICT)
        other = 'guest' if side == 'host' else 'host'
        seen = getattr(room, f'{other}_seen')
        if seen is not None and timezone.now() - seen < DISCONNECT_AFTER:
            return _err('opponent_connected', status.HTTP_409_CONFLICT)
        _end(room, 'forfeit', {'side': other})
        room.updated_at = timezone.now()
        room.save()
    return Response(status=status.HTTP_204_NO_CONTENT)
