from rest_framework.test import APITestCase

from .models import User


class AuthTests(APITestCase):
    def register(self, username='alice', password='secret1'):
        return self.client.post('/api/auth/register/', {'username': username, 'password': password}, format='json')

    def test_register_creates_user_with_zero_stats_and_hashed_password(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user'], {'id': res.data['user']['id'], 'username': 'alice', 'trophies': 0, 'wins': 0, 'draws': 0})
        user = User.objects.get(username='alice')
        self.assertNotEqual(user.password, 'secret1')
        self.assertTrue(user.check_password('secret1'))

    def test_register_rejects_duplicate_username_ignoring_case(self):
        self.register('Alice')
        res = self.register('alice')
        self.assertEqual(res.status_code, 400)
        self.assertIn('username', res.data)

    def test_register_rejects_bad_username_and_short_password(self):
        self.assertEqual(self.register('a b').status_code, 400)
        self.assertEqual(self.register('ab').status_code, 400)
        self.assertEqual(self.register('bob', '123').status_code, 400)

    def test_login_ok_and_case_insensitive(self):
        self.register('Alice', 'secret1')
        res = self.client.post('/api/auth/login/', {'username': 'alice', 'password': 'secret1'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['user']['username'], 'Alice')

    def test_login_wrong_password_or_unknown_user_same_error(self):
        self.register('alice')
        wrong = self.client.post('/api/auth/login/', {'username': 'alice', 'password': 'nope123'}, format='json')
        unknown = self.client.post('/api/auth/login/', {'username': 'ghost', 'password': 'nope123'}, format='json')
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(wrong.data, unknown.data)

    def test_me_requires_token_and_logout_revokes_it(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        token = self.register().data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['username'], 'alice')
        self.assertNotIn('password', me.data)
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_validation_errors_are_stable_codes(self):
        self.register('alice')
        taken = self.register('ALICE')
        self.assertEqual(taken.data['username'], ['taken'])
        self.assertEqual(self.register('bob', '123').data['password'], ['password_too_short'])
        self.assertEqual(self.register('a b').data['username'], ['invalid'])
