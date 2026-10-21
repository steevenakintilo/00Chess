from django.urls import path

from . import views

urlpatterns = [
    path('', views.create_room),
    path('join/', views.join_room),
    path('<str:code>/', views.room_detail),
    path('<str:code>/state/', views.room_state),
    path('<str:code>/move/', views.send_move),
    path('<str:code>/duel-result/', views.duel_result),
    path('<str:code>/action/', views.send_action),
    path('<str:code>/game-over/', views.game_over),
    path('<str:code>/forfeit/', views.forfeit),
    path('<str:code>/claim/', views.claim_victory),
]
