from django.contrib import admin

from .models import Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('code', 'host', 'guest', 'created_at')
    search_fields = ('code', 'host__username', 'guest__username')
    readonly_fields = ('code', 'created_at')
