from users_api.models import User, Score, Lobby
from rest_framework import serializers

class DynamicFieldsSerializer(serializers.ModelSerializer):
	def __init__(self, *args, **kwargs):
		# Don't pass the 'fields' arg up to the superclass
		fields = kwargs.pop('fields', None)

		# Instantiate the superclass normally
		super().__init__(*args, **kwargs)

		if fields is not None:
			# Drop any fields that are not specified in the `fields` argument.
			allowed = set(fields)
			existing = set(self.fields)
			for field_name in existing - allowed:
				self.fields.pop(field_name)

class ScoreSerializer(DynamicFieldsSerializer):
	user = 	serializers.CharField(source='user.username')
	lobby = serializers.IntegerField(source='lobby.lobby_id')

	class Meta:
		model = Score
		fields = ['user', 'lobby', 'score', 'has_win',]

class LobbySerializer(serializers.HyperlinkedModelSerializer):
	scores_set = ScoreSerializer(many=True, fields=['user', 'score', 'has_win'])

	class Meta:
		model = Lobby
		fields = ('lobby_id', 'game_name', 'scores_set')

class UserSerializer(serializers.HyperlinkedModelSerializer):
	scores_set = ScoreSerializer(many=True, read_only=True, fields=['lobby', 'score', 'has_win'], required=False)
	avatar = serializers.SerializerMethodField(read_only=True)
	url_avatar = serializers.URLField(write_only=True, source='external_avatar', required=False)

	class Meta:
		model = User
		fields = ['username', 'url_avatar', 'avatar', 'scores_set']

	def get_avatar(self, obj: User):
		return obj.get_avatar_url()


class AvatarUploadSerializer(serializers.HyperlinkedModelSerializer):
	uploaded_avatar = serializers.ImageField(required = False, write_only = True)
	external_avatar = serializers.URLField(required = False, write_only = True)

	class Meta:
		model = User
		fields = ['external_avatar', 'uploaded_avatar']
