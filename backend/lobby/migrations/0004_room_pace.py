from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lobby', '0003_room_mode_room_pending'),
    ]

    operations = [
        migrations.AddField(
            model_name='room',
            name='pace',
            field=models.CharField(default='blitz', max_length=10),
        ),
    ]
