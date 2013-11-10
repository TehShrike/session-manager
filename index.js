var EventEmitter = require('events').EventEmitter
var StringMap = require('stringmap')
var Expirer = require('expire-unused-keys')

function UUID() {
	// 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
	return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
		return v.toString(16)
	})
}

function SessionManager(logOutAfterThisManySecondsOfInactivity, loginKeysExpireAfterThisManySeconds, sessionsDisappearAfterThisManySeconds) {
	sessionsDisappearAfterThisManySeconds = sessionsDisappearAfterThisManySeconds || (60 * 60 * 24 * 7)
	
	var sessionLogOutTimer = new Expirer(logOutAfterThisManySecondsOfInactivity)
	var sessionDeletion = new Expirer(sessionsDisappearAfterThisManySeconds)
	var loginKeyExpiration = new Expirer(loginKeysExpireAfterThisManySeconds)

	var sessionsMap = new StringMap()

	function getSession(cb) {
		return function(sessionKey) {
			var session = sessionsMap.get(sessionKey)
			if (session) {
				cb(session)
			}			
		}
	}

	sessionLogOutTimer.on('expire', getSession(function(session) {
		session.logOut()			
	}))

	sessionDeletion.on('expire', getSession(function(session) {
		session.logOut()
		sessionsMap.remove(session.getSessionKey())
	}))

	loginKeyExpiration.on('expire', getSession(function(session) {
		session.invalidateLoginKey()
	}))

	function createSession() {
		var sessionKey = UUID()
		var latestLoginKey = undefined
		var userId = undefined
		var isLoggedIn = false

		sessionLogOutTimer.emit('touch', sessionKey)

		var session = new EventEmitter()
		session.getSessionKey = function() {
			return sessionKey
		}
		session.getUserId = function() {
			return userId
		}
		session.getLoginKey = function(newUserId) {
			if (isLoggedIn) {
				this.logOut()
			}
			loginKeyExpiration.emit('touch', sessionKey)
			sessionLogOutTimer.emit('touch', sessionKey)
			sessionDeletion.emit('touch', sessionKey)
			userId = newUserId
			latestLoginKey = UUID()
			return latestLoginKey
		}
		session.logIn = function(providedLoginKey) {
			if (providedLoginKey === latestLoginKey) {
				latestLoginKey = undefined
				sessionLogOutTimer.emit('touch', sessionKey)
				this.emit('loggedin')
				sessions.emit('loggedin', this)
				isLoggedIn = true
			}
		}
		session.invalidateLoginKey = function() {
			latestLoginKey = undefined
		}
		session.isLoggedIn = function() {
			return isLoggedIn
		}
		session.logOut = function() {
			if (isLoggedIn) {
				isLoggedIn = false
				this.emit('loggedout')
				sessions.emit('loggedout', this)				
			}
		}

		sessionsMap.set(sessionKey, session)

		return session
	}

	var sessions = new EventEmitter()

	sessions.createSession = createSession
	sessions.getSession = function(sessionKey) {
		sessionLogOutTimer.emit('touch', sessionKey)
		sessionDeletion.emit('touch', sessionKey)
		return sessionsMap.get(sessionKey)
	}

	return sessions
}

module.exports = SessionManager
