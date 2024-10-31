import { BaseView } from '../view-manager.js';
import { authenticatedUser, User, userManager } from '../home.js';
import QrCreator from 'https://cdn.jsdelivr.net/npm/qr-creator/dist/qr-creator.es6.min.js';

export default class ProfileView extends BaseView {
    constructor() {
        super('profile-view');
		this.patchProfileUrl = `https://${window.location.host}/api/users/${authenticatedUser.username}/`;
		this.patchCredentialsUrl = `https://${window.location.host}/api/auth/me/`;
		this.isValidUrlAvatar = false;
		this.defaultAvatarUrl = '/avatars/__default__.jpg';
    }

    async initView() {
		this.avatarFile = document.getElementById('avatar');
		this.avatarUrl = document.getElementById('avatarUrl');
		this.profileForm = document.getElementById('profileForm');
		this.securityForm = document.getElementById('securityForm');
		this.avatarPreview = document.getElementById('avatarPreview');
		this.resetFormButon = document.getElementById('resetFormButton');
		this.password = document.getElementById('password');
		this.confirmPassword = document.getElementById('confirmPassword');
		this.addFriendBtn = document.getElementById('add-friend-btn');
		this.friendInput = document.getElementById('new-friend-input');
	
		this.avatarFile.addEventListener('change', (e) => {
			e.preventDefault();
			this.onAvatarFileChange(e.target.files[0])
		});
		this.avatarUrl.addEventListener('change', (e) => {
			e.preventDefault();
			this.onAvatarUrlChange(e.target.value)
		});
		this.profileForm.addEventListener('submit', (e) => {
			e.preventDefault();
			this.submitUserInfos();
		});
		this.securityForm.addEventListener('submit', (e) => {
			e.preventDefault();
			this.submitCredentials();
		});
		this.resetFormButon.addEventListener('click', (e) => {
			e.preventDefault();
			this.resetForm();
		});
		this.password.addEventListener('change', (e) => {
			e.preventDefault();
			this.onPasswordChange();
		});
		this.confirmPassword.addEventListener('change', (e) => {
			e.preventDefault();
			this.onPasswordChange();
		});
		this.addFriendBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.addFriend();
		});

		this.resetForm();
		await this.retrieveAuthInfos();
		await this.initSecurityForm();
		await this.init2FA();
		
		userManager.setDynamicUpdateHandler(this.updateUserInfos);
		await this.updateFriendsList();
		await userManager.forceUpdate();

		
	}

	async retrieveAuthInfos() {
		try {
			const response = await fetch(this.patchCredentialsUrl, {method: 'GET'});
			console.log(response.status);
			if (!response.ok) {
				throw new Error("Error retrieving authentication informations");
			}
			this.credentialsInfos = await response.json();
			console.log(this.credentialsInfos);
		} catch (error) {
			this.errorHandler(error);
		}
	}

	async initSecurityForm() {
		this.securityForm.email.value = this.credentialsInfos.email;
		if (authenticatedUser.username.startsWith('042'))
			this.disableSecurityForm();
		else {
			this.enableSecurityForm();
			this.onPasswordChange();
		}
	}

	resetForm() {
		this.avatarFile.value = "";
		this.avatarUrl.value = "";
		this.avatarPreview.src = authenticatedUser.avatar + "#" + new Date().getTime();
		this.profileForm.displayName.value = authenticatedUser.display_name;
	}

	onPasswordChange() {
		if (this.password.value !== this.confirmPassword.value) {
			this.password.setCustomValidity("");
			this.confirmPassword.setCustomValidity("Passwords must match.")
		} else {
			this.password.setCustomValidity("");
			this.confirmPassword.setCustomValidity("");
		}
	}

	onAvatarFileChange(file) {
		if (file) {
			const reader = new FileReader();
			reader.onload = function(e) {
				document.getElementById('avatarPreview').src = e.target.result;
			}
			reader.readAsDataURL(file);
		}
	}

	disableSecurityForm() {
		const form = document.getElementById('securityForm');
		const securityMessage = document.querySelector('.security-message');
		
		// form.classList.add('form-disabled');
		form.password.value = "";
		form.confirmPassword.value = "";
		securityMessage.style.display = 'block';
		
		const inputs = form.querySelectorAll('input:not(#enable2FA)');
		console.log(inputs);
		inputs.forEach(input => input.disabled = true);
	}

	enableSecurityForm() {
		const form = document.getElementById('securityForm');
		const securityMessage = document.querySelector('.security-message');
		
		form.classList.remove('form-disabled');
		securityMessage.style.display = 'none';
		
		const inputs = form.querySelectorAll('input:not(#enable2FA)');
		inputs.forEach(input => input.disabled = false);
	}

	async onAvatarUrlChange(url) {
		if (url) {	
			try {
				const response = await fetch(url, {
					method: 'HEAD'
				});
				if (!response.ok || !response.headers.get('Content-Type').startsWith('image/'))
					throw new Error('Could not fetch a valid avatar');
				if (this.avatarFile.value === "")
				this.avatarPreview.src = url;
					this.avatarUrl.setCustomValidity("");
			} catch (error) {
				this.avatarUrl.setCustomValidity("Invalid avatar.");
				if (this.avatarFile.value === "")
					this.avatarPreview.src = this.defaultAvatarUrl;
			}
		} else
		this.avatarUrl.setCustomValidity("");
	}

	async submitUserInfos() {
		console.log('Envoi des données du profil');
		const formData = new FormData();
		formData.append("url_avatar", this.avatarUrl.value);
		formData.append("display_name", this.profileForm.displayName.value);
		if (this.avatarFile.files[0])
			formData.append("uploaded_avatar", this.avatarFile.files[0]);
		try {
			const response = await fetch(this.patchProfileUrl, {
				method: 'PATCH',
				body: formData
			});
			if (response.status === 400)
				throw new Error(Object.entries(await response.json())[0]);
			if (!response.ok)
				throw new Error("Failed to updated informations.");
			Object.assign(authenticatedUser, await response.json());
			this.resetForm();
			this.successHandler("Informations updated !");
		} catch (error) {
			this.errorHandler(error);
		}
	}

	async submitCredentials()
	{
		console.log('Envoi des données de securite');
		try {
			const response = await fetch(this.patchCredentialsUrl, {
				method: 'PATCH',
				headers: {'Content-Type': 'application/json',},
				body: JSON.stringify({
					username: authenticatedUser.username,
					email: this.securityForm.email.value,
					password: (this.securityForm.password.value ? this.securityForm.password.value: undefined),
					is_2fa_active: this.securityForm.enable2FA.checked
				})
			});
			if (response.status === 400)
				throw new Error(Object.entries(await response.json())[0]);
			if (!response.ok)
				throw new Error("Failed to updated informations.");
			this.credentialsInfos = await response.json();
			this.successHandler("Login credentials successfully updated !");
			this.init2FA();
		} catch (error) {
			this.errorHandler(error);
		}
	}

	async updateFriendsList() {
		const friendsList = document.getElementById('friends-list');
		
		friendsList.innerHTML = '';
		console.log(authenticatedUser.friends);
		authenticatedUser.friends.forEach(async user => {
			const friend = new User(user, await userManager.getUserInfo(user));
			// console.log(friend);
			const friendElement = document.createElement('div');
			friendElement.classList.add('friend-element', 'col', `user-${user}`);
			friendElement.innerHTML = `
				<div class="friend-status ${friend.is_online ? 'online' : 'offline'}">
					<img src="${friend.avatar}"
						class="friend-avatar" 
						onclick="window.location.href='#user?username=${user}'">
						<span class="friend-tooltip">${friend.display_name}</span>
						<div class="remove-friend user-${user}">✕</div>
				</div>
				<div class="friend-name user-${user}">${friend.display_name}</div>
			`;
			friendElement.querySelector(`.remove-friend.user-${user}`).addEventListener('click', async () => {
				this.removeFriend(user);
			});
			
			friendsList.appendChild(friendElement);
		});
	}

	async removeFriend(userId) {
		try {
			await authenticatedUser.removeFriend(userId);
		} catch (error) {
			this.errorHandler('Cannot remove friend:' + error);
			return;
		}
		this.successHandler(`${userId} is no longer a friend of yours :-/`);

		await this.updateFriendsList();
	}
	
	async addFriend() {
		const newFriendName = this.friendInput.value.trim();
		if (newFriendName) {
			try {
				await authenticatedUser.addFriend(newFriendName);
				if (!authenticatedUser.friends.includes(newFriendName))
					throw new Error("");
			} catch (error) {
				this.errorHandler(`Cannot add ${newFriendName} as a friend: ${error.message}`);
				return;
			}
			this.friendInput.value = '';
			this.successHandler(`${newFriendName} is now a friend of yours !`);
			await this.updateFriendsList();
		}
	}

	async init2FA() {
		const container = document.querySelector('#qrcode')
		if (this.credentialsInfos.is_2fa_active) {
			document.getElementById('container-2FA').classList.remove('d-none');
			this.securityForm.enable2FA.checked = true;
			try {
				container.innerHTML = '';
				document.getElementById("totp-secret").value = this.credentialsInfos.totp_secret;
				QrCreator.render({
					text: `otpauth://totp/${authenticatedUser.username}?secret=${this.credentialsInfos.totp_secret}&issuer=ft-trestresdense`,
					radius: 0.5, // 0.0 to 0.5
					ecLevel: 'H', // L, M, Q, H
					fill: '#536DFE', // foreground color
					background: null, // color or null for transparent
					size: 256 // in pixels
				  }, document.querySelector('#qrcode'));
			} catch (error) {
				this.errorHandler("Error loading 2FA qr-code");
			}
		} else {
			document.getElementById('container-2FA').classList.add('d-none');
			container.innerHTML = "";
		}
	}

	async updateUserInfos(username, data) {
		const friend_el = document.querySelector(`.friend-element.user-${username}`);
		const user = new User(username, data);

		if (friend_el) {
			const status_div = friend_el.querySelector('.friend-status');
			status_div.classList.remove('online', 'offline');
			status_div.classList.add(user.is_online ? 'online' : 'offline');
			friend_el.querySelector('img').src = user.avatar;
			friend_el.querySelector('span').innerText = user.display_name;
			friend_el.querySelector(`.friend-name.user-${username}`).innerText = user.display_name;
		}
	}

	async cleanupView() {
        this.avatarFile.removeEventListener('change', this.onAvatarFileChange);
		this.avatarUrl.removeEventListener('change', this.onAvatarUrlChange);
		this.profileForm.removeEventListener('submit', this.submitUserInfos);
		this.securityForm.removeEventListener('submit', this.submitCredentials);
		this.resetFormButon.removeEventListener('click', this.resetForm);
		this.confirmPassword.removeEventListener('click', this.onPasswordChange);
    }

}