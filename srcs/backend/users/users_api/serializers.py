from users_api.models import User, Score, Lobby, Tournament
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

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

class ScoreListSerializer(serializers.ListSerializer):
	def create(self, validated_data):
		# scores = [Score(**item) for item in validated_data]
		# return Score.objects.bulk_create(scores)
		pass

	def validate(self, attrs):
		print("pouet")
		return attrs
		# return super().validate(attrs)
	
	@classmethod
	def many_init(cls, *args, **kwargs):
		print("plouf")
		# Instantiate the child serializer.
		kwargs['child'] = cls()
		# Instantiate the parent list serializer.
		return ScoreListSerializer(*args, **kwargs)

class ScoreSerializer(DynamicFieldsSerializer):
	username = 	serializers.CharField(source='user.username', allow_blank=True)
	display_name = serializers.CharField(source='user.display_name', allow_blank=True, required=False, read_only=True)
	lobby = serializers.CharField(source='lobby.lobby_id', read_only=True)
	turnament_id = serializers.CharField(source='lobby.tournament.turnament_id', read_only=True, allow_blank=True, required=False)

	class Meta:
		model = Score
		fields = ['username', 'display_name', 'lobby', 'score', 'has_win', 'turnament_id',]
		list_serializer_class = ScoreListSerializer

	def validate_username(self, value):
		"""
		Check that the given username exists
		"""
		if value:
			try:
				User.objects.get(username=value)
			except:
				raise serializers.ValidationError({"user.username": "this user does not exist"})
		return value


class LobbySerializer(DynamicFieldsSerializer):
	scores_set = ScoreSerializer(many=True, fields=['username', 'display_name', 'score', 'has_win',])
	turnament_id = serializers.CharField(required=False, source='tournament.turnament_id', allow_blank=True)

	class Meta:
		model = Lobby
		fields = ('lobby_id', 'game_name', 'turnament_id', 'scores_set',)
		read_only_fields = ('date',)

	def create(self, validated_data):
		lobby = Lobby(
			lobby_id = validated_data["lobby_id"],
			game_name = validated_data["game_name"],
		)
		if 'tournament' in validated_data and 'turnament_id' in validated_data['tournament']:
				try:
					lobby.tournament = Tournament.objects.get(turnament_id=validated_data['tournament']["turnament_id"])
				except:
					lobby.tournament = Tournament.objects.create(
						turnament_id = validated_data['tournament']["turnament_id"],
						game_name = validated_data["game_name"],
						number_players = 0,
					)
		else: lobby.tournament = None
		lobby.save()
		
		scores_list = validated_data.pop('scores_set')
		for score_data in scores_list:
			Score.objects.create(
				user=User.objects.get(username=score_data['user']['username']),
				lobby=lobby,
				score=score_data['score'],
				has_win=score_data['has_win'],
			)
		return lobby

class TurnamentSerializer(serializers.HyperlinkedModelSerializer):
	lobbys_set = LobbySerializer(many=True, read_only=True, fields=['lobby_id', 'scores_set',])

	class Meta:
		model = Tournament
		fields = ('turnament_id', 'game_name', 'date', 'number_players', 'lobbys_set',)

class UserSerializer(serializers.HyperlinkedModelSerializer):
	username = serializers.CharField(read_only=True)
	scores_set = ScoreSerializer(many=True, read_only=True, fields=['lobby', 'turnament_id', 'score', 'has_win',], required=False)
	avatar = serializers.SerializerMethodField(read_only=True)
	uploaded_avatar = serializers.ImageField(required = False, write_only = True)
	url_avatar = serializers.URLField(write_only=True, source='external_avatar', required=False)
	display_name = serializers.CharField(max_length=30, required=False)

	class Meta:
		model = User
		fields = ['username', 'display_name', 'uploaded_avatar', 'url_avatar', 'avatar', 'scores_set',]

	def get_avatar(self, obj: User):
		return obj.get_avatar_url()

class UserCreationSerializer(serializers.HyperlinkedModelSerializer):
	url_avatar = serializers.URLField(write_only=True, source='external_avatar', required=False)
	display_name = serializers.CharField(max_length=30, required=False)

	class Meta:
		model = User
		fields = ['username', 'url_avatar', 'display_name',]

# class AvatarUploadSerializer(serializers.HyperlinkedModelSerializer):
# 	uploaded_avatar = serializers.ImageField(required = False, write_only = True)
# 	external_avatar = serializers.URLField(required = False, write_only = True),

# 	class Meta:
# 		model = User
# 		fields = ['external_avatar', 'uploaded_avatar']
