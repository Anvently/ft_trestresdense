from users_api.models import User, Score, Lobby, Tournament
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from typing import Any, Dict

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
		return attrs
		# return super().validate(attrs)
	
	@classmethod
	def many_init(cls, *args, **kwargs):
		# Instantiate the child serializer.
		kwargs['child'] = cls()
		# Instantiate the parent list serializer.
		return ScoreListSerializer(*args, **kwargs)

class ScoreSerializer(DynamicFieldsSerializer):
	username = 	serializers.CharField(source='user.username', allow_blank=True, required=False)
	display_name = serializers.CharField(source='user.display_name', allow_blank=True, required=False, read_only=True)
	lobby_id = serializers.CharField(source='lobby.lobby_id', read_only=True)
	lobby_name = serializers.CharField(source='lobby.lobby_name', read_only=True)
	game_name = serializers.CharField(source='lobby.game_name', read_only = True)
	tournament_id = serializers.CharField(source='lobby.tournament.tournament_id', read_only=True, allow_blank=True, required=False)
	score = serializers.IntegerField(required=True)

	class Meta:
		model = Score
		fields = ['username', 'display_name', 'lobby_id', 'lobby_name', 'game_name', 'score', 'has_win', 'date', 'tournament_id',]
		list_serializer_class = ScoreListSerializer

	def to_representation(self, instance):
		ret = super().to_representation(instance)
		if instance.user == None:
			ret['username'] = "!bot"
			ret['display_name'] = "BotUser"
		return ret


class LobbySerializer(DynamicFieldsSerializer):
	scores_set = ScoreSerializer(many=True, fields=['username', 'display_name', 'score', 'has_win',])
	tournament_id = serializers.CharField(required=False, source='tournament.tournament_id', allow_blank=True)
	tournament_name = serializers.CharField(required=False, source='tournament.tournament_name', allow_blank=True)
	host = serializers.CharField(required=False, source='host.username', allow_blank=True)
	lobby_name = serializers.CharField(required=True)

	class Meta:
		model = Lobby
		fields = ('lobby_id', 'lobby_name', 'host', 'game_name', 'tournament_id', 'tournament_name', 'date', 'scores_set',)
		# read_only_fields = ('date',)

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.host_instance = None

	def to_representation(self, instance):
		ret = super().to_representation(instance)
		if not ret.get('host', None) and instance.tournament:
			ret['host'] = instance.tournament.host.username
		return ret

	def validate(self, attrs):
		attrs = super().validate(attrs)
		try:
			if 'host' in attrs:
				attrs['host'] = User.objects.get(username=attrs['host']['username'])
		except:
			raise serializers.ValidationError({"host": [f"User {attrs['host']['username']} does not exists."]})
		try:
			if 'tournament' in attrs:
				attrs['tournament'] = Tournament.objects.get(tournament_id=attrs['tournament']["tournament_id"])
		except:
			raise serializers.ValidationError({"tournament_id" : ["No tournament exists with this id"]})
		if not 'host' in attrs and not 'tournament' in attrs:
			raise serializers.ValidationError({'host, tournament_id': "You must provide information on one of these fields."})
		return attrs

	def create(self, validated_data):
		lobby = Lobby(
			lobby_id = validated_data["lobby_id"],
			lobby_name = validated_data["lobby_name"],
			game_name = validated_data["game_name"],
			host = validated_data.get("host", None),
			tournament = validated_data.get("tournament", None)
		)
		lobby.save()
		
		scores_list = validated_data.pop('scores_set')
		for score_data in scores_list:
			try:
				if score_data['user']['username'][0] == '!':
					user = None
				else:
					user = User.objects.get(username=score_data['user']['username'])
			except Exception as e:
				raise serializers.ValidationError({"username": [f"Not provided or user {score_data['user']['username']} does not exists."]})
			Score.objects.create(
				user=user,
				lobby=lobby,
				score=score_data.get('score', 0),
				has_win=score_data['has_win'],
			)
		return lobby

class TournamentSerializer(serializers.HyperlinkedModelSerializer):
	lobbies_set = LobbySerializer(many=True, read_only=True, fields=['lobby_id', 'lobby_name', 'scores_set',])
	host = serializers.CharField(required=True, source='host.username', allow_blank=True)

	class Meta:
		model = Tournament
		fields = ('tournament_id', 'tournament_name', 'host', 'game_name', 'date', 'number_players', 'lobbies_set',)

	def validate(self, attrs):
		attrs = super().validate(attrs)
		try:
			if 'host' in attrs:
				attrs['host'] = User.objects.get(username=attrs['host']['username'])
		except:
			raise serializers.ValidationError({"host": [f"User {attrs['host']['username']} does not exists."]})	
		return attrs

	def create(self, validated_data):
		return Tournament.objects.create(
			tournament_id=validated_data['tournament_id'],
			tournament_name=validated_data.get('tournament_name', None),
			game_name=validated_data['game_name'],
			number_players=validated_data['number_players'],
			host=validated_data['host']
		)


class UserSerializer(serializers.HyperlinkedModelSerializer):
	username = serializers.CharField(read_only=True)
	scores_set = ScoreSerializer(many=True, read_only=True, fields=['lobby_id', 'lobby_name', 'game_name', 'tournament_id', 'score', 'has_win', 'date',], required=False)
	avatar = serializers.SerializerMethodField(read_only=True)
	uploaded_avatar = serializers.ImageField(required = False, write_only = True)
	url_avatar = serializers.URLField(write_only=True, source='external_avatar', required=False)
	display_name = serializers.CharField(max_length=30, required=False)
	friends = serializers.SerializerMethodField(read_only=True)

	class Meta:
		model = User
		fields = ['username', 'display_name', 'uploaded_avatar', 'url_avatar', 'avatar', 'last_visit', 'friends', 'scores_set',]

	def get_avatar(self, obj: User):
		return obj.get_avatar_url()
	
	def get_friends(self, obj: User):
		return [friend.username for friend in obj.friends.all()]

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
