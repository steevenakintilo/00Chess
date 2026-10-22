import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

# Sans 0/O/1/I pour éviter les confusions quand on dicte le code à un ami.
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 6
# Une salle sans aucune activité (ni requête des joueurs) pendant ce temps est supprimée.
ROOM_LIFETIME = timedelta(hours=1)
# Un joueur sans nouvelles depuis ce temps est considéré comme déconnecté (l'autre peut réclamer la victoire).
DISCONNECT_AFTER = timedelta(seconds=30)

GAME_MODES = ('winner', 'turns')  # winner : le gagnant du duel joue ; turns : tour par tour (les deux jouent chaque round)

PACES = ('blitz', 'normal')  # blitz : partie limitée à 50 rounds ; normal : pas de limite, le premier qui gagne gagne

MOVES_007 = ('CHARGER', 'BOUCLIER', 'TIRER', 'GROS TIR', 'PLUS DE POINTS', 'SWAP')


def generate_code() -> str:
    """Génère un code de salle qui n'existe pas encore."""
    for _ in range(50):
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not Room.objects.filter(code=code).exists():
            return code
    raise RuntimeError('Impossible de générer un code de salle unique.')


class Room(models.Model):
    """Salle « jouer avec un pote » : l'hôte la crée, son ami la rejoint avec le code.

    Une fois les deux joueurs présents, la partie démarre. Le serveur est l'arbitre de l'ordre des
    coups et cache les coups du 007 tant que les deux joueurs n'ont pas joué ; les règles du jeu
    sont rejouées à l'identique chez chaque joueur (le serveur vérifie que les deux sont d'accord).
    """

    PHASE_LOBBY = 'lobby'  # en attente de l'ami
    PHASE_DUEL = 'duel'  # les deux joueurs choisissent leur coup de 007
    PHASE_ACTION = 'action'  # le gagnant du duel joue sur le plateau
    PHASE_OVER = 'over'  # partie terminée

    code = models.CharField(max_length=CODE_LENGTH, unique=True, default=generate_code, editable=False)
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hosted_rooms')
    guest = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='joined_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(default=timezone.now)

    # ----- état de la partie
    phase = models.CharField(max_length=10, default=PHASE_LOBBY)
    round = models.PositiveIntegerField(default=0)  # numéro du round (un duel de 007 + une action)
    exchange = models.PositiveIntegerField(default=1)  # n-ième échange de coups dans le duel en cours
    actor = models.CharField(max_length=5, null=True, blank=True)  # 'host' / 'guest' : qui joue en phase action
    mode = models.CharField(max_length=10, default='winner')  # voir GAME_MODES
    pace = models.CharField(max_length=10, default='blitz')  # voir PACES
    pending = models.JSONField(default=list, blank=True)  # joueurs qui joueront encore ce round, après `actor`
    reports = models.JSONField(default=dict, blank=True)  # comptes rendus des deux joueurs (accord)
    last_seq = models.PositiveIntegerField(default=0)
    host_seen = models.DateTimeField(null=True, blank=True)
    guest_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_full(self) -> bool:
        return self.guest_id is not None

    def side_of(self, user) -> str | None:
        if user.id == self.host_id:
            return 'host'
        if self.guest_id is not None and user.id == self.guest_id:
            return 'guest'
        return None

    def __str__(self) -> str:
        return f'{self.code} ({self.host})'


class GameEvent(models.Model):
    """Événement public de la partie, numéroté : chaque joueur les rejoue dans l'ordre."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='events')
    seq = models.PositiveIntegerField()
    kind = models.CharField(max_length=20)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['seq']
        constraints = [models.UniqueConstraint(fields=['room', 'seq'], name='unique_event_seq_per_room')]


class Move007(models.Model):
    """Coup de 007 choisi par un joueur, caché à l'autre tant que les deux n'ont pas joué."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='moves')
    round = models.PositiveIntegerField()
    exchange = models.PositiveIntegerField()
    side = models.CharField(max_length=5)
    move = models.CharField(max_length=20)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['room', 'round', 'exchange', 'side'], name='one_move_per_side_and_exchange')
        ]


class SiteStats(models.Model):
    """Compteurs globaux du site (une seule ligne, pk=1)."""

    games_played = models.PositiveIntegerField(default=0)  # parties en ligne terminées (victoire, égalité ou abandon)

    @classmethod
    def add_game(cls) -> None:
        cls.objects.get_or_create(pk=1)
        cls.objects.filter(pk=1).update(games_played=models.F('games_played') + 1)  # atomique, sans course entre salles
