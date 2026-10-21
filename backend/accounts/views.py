from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class AuthThrottle(ScopedRateThrottle):
    scope = 'auth'


def _auth_response(user: User, http_status=status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=http_status)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return _auth_response(user, status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    user = User.objects.filter(username__iexact=username, is_active=True).first()
    # même réponse que le pseudo existe ou non : on ne révèle pas quels comptes existent
    if user is None or not check_password(password, user.password):
        return Response({'detail': 'invalid_credentials'}, status=status.HTTP_400_BAD_REQUEST)
    return _auth_response(user)


@api_view(['POST'])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user).data)
