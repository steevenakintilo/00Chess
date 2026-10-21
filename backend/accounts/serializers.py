from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, username_validator


class UserSerializer(serializers.ModelSerializer):
    """Ce que le front a le droit de voir d'un joueur (jamais le mot de passe)."""

    class Meta:
        model = User
        fields = ['id', 'username', 'trophies', 'wins', 'draws']
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20, validators=[username_validator])
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Ce nom est déjà pris.', code='taken')
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(validated_data['username'], validated_data['password'])


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
