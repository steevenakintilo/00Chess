from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

username_validator = RegexValidator(
    r'^[A-Za-z0-9_]{3,20}$',
    "3 à 20 caractères : lettres, chiffres ou _ (pas d'espace ni d'accent).",
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, username, password=None, **extra):
        if not username:
            raise ValueError("Le nom d'utilisateur est obligatoire.")
        user = self.model(username=username, **extra)
        user.set_password(password)  # le mot de passe est toujours haché, jamais stocké en clair
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Joueur du 00Chess : pseudo + mot de passe (pas d'e-mail), avec ses statistiques."""

    username = models.CharField(max_length=20, unique=True, validators=[username_validator])

    # statistiques en ligne (pour un futur classement)
    trophies = models.PositiveIntegerField(default=0)
    wins = models.PositiveIntegerField(default=0)
    draws = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        constraints = [
            # "Paul" et "paul" sont le même pseudo
            models.UniqueConstraint(Lower('username'), name='unique_username_ci'),
        ]

    def __str__(self) -> str:
        return self.username
