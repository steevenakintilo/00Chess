from django.contrib import admin

from .models import FinishedGame, Room, SiteStats


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('code', 'host', 'guest', 'created_at')
    search_fields = ('code', 'host__username', 'guest__username')
    readonly_fields = ('code', 'created_at')


admin.site.register(SiteStats)


@admin.register(FinishedGame)
class FinishedGameAdmin(admin.ModelAdmin):
    list_display = ('code', 'host_name', 'guest_name', 'created_at')
    search_fields = ('code', 'host_name', 'guest_name')
    readonly_fields = ('code', 'created_at')
