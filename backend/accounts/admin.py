from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ('username', 'trophies', 'wins', 'draws', 'is_staff', 'date_joined')
    search_fields = ('username',)
    ordering = ('-trophies', 'username')
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Statistiques', {'fields': ('trophies', 'wins', 'draws')}),
        ('Droits', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('username', 'password1', 'password2')}),)
