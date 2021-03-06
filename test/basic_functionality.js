var test = require('tap').test
var SessionManager = require("../")

test("Basic session/login use", function(t) {
	var logOutAfterThisManySecondsOfInactivity = 5
	var sessions = new SessionManager(logOutAfterThisManySecondsOfInactivity, 10)

	var mySession = sessions.createSession()

	var theKeyYouPutOnTheCookie = mySession.getSessionKey()
	t.equal(typeof theKeyYouPutOnTheCookie, "string", "The session key is a string")

	t.equal(typeof mySession.getUserId(), "undefined", "The session's userId is undefined")

	var userId = 'me@JoshDuff.com'
	var loginKey = mySession.getLoginKey(userId)
	t.equal(typeof loginKey, "string", "login key is a string")
	t.equal(mySession.getUserId(), userId, "The session's userId is the same as the one previously passed in")

	//////////// ^^^ the user hits the login button


	////// Here, they clicked on the link
	var thatSameSession = sessions.getSession(theKeyYouPutOnTheCookie)

	thatSameSession.logIn('This key better not be generated by the library, srsly')
	t.notOk(thatSameSession.isLoggedIn(), "The session is not logged in")

	thatSameSession.logIn(loginKey)
	t.ok(thatSameSession.isLoggedIn(), "The session is logged in")

	// This call will be ignored and nothing will happen because the login key was already used
	thatSameSession.logIn(loginKey)
	
	var loggedIn = thatSameSession.isLoggedIn()
	t.ok(loggedIn, "The session is still logged in")

	sessions.on('loggedout', function(session) {
		t.ok(loggedIn, "The session was logged in the last time we checked before the loggedout event fired")
		loggedIn = false
	})

	// After a certain amount of time, sessions are automatically logged out
	setTimeout(function() {
		t.notOk(loggedIn, "The session is not logged in after 5.5 seconds")

		// Login keys become invalid as soon as they are used
		thatSameSession.logIn(loginKey)
		t.notOk(thatSameSession.isLoggedIn(), "The session is not logged in even after calling logIn again with the previous loginKey")

		t.end()
	}, 5500)
})

test("After a certain amount of time, login keys become invalid", function(t) {
	var logOutAfterThisManySecondsOfInactivity = 5
	var loginKeysExpireAfterThisManySeconds = 5
	var sessions = new SessionManager(logOutAfterThisManySecondsOfInactivity, loginKeysExpireAfterThisManySeconds, 6)

	var mySession = sessions.createSession()

	var userId = 'me@JoshDuff.com'
	var loginKey = mySession.getLoginKey(userId)

	setTimeout(function() {
		mySession.logIn(loginKey)
		t.notOk(mySession.isLoggedIn(), "The logIn call failed after waiting 5.5 seconds")

		var loginKeyTakeTwo = mySession.getLoginKey(userId)
		setTimeout(function() {
			mySession.logIn(loginKeyTakeTwo)
			t.ok(mySession.isLoggedIn(), "the logIn call succeeds if you do it in under 5 seconds")
			t.end()
		}, 3000)
	}, 5500)

})

test("Only one email address associated with a session", function(t) {
	// One email address associated with a session key at a time (the most recent)
	// If an email address is logged in on a session, and that session tries to log in with a new email address,
	// log that session out for the previous email address

	var logOutAfterThisManySecondsOfInactivity = 5
	var loginKeysExpireAfterThisManySeconds = 5
	var sessions = new SessionManager(logOutAfterThisManySecondsOfInactivity, loginKeysExpireAfterThisManySeconds)

	var mySession = sessions.createSession()

	var firstLoginKey = mySession.getLoginKey('misspelled@whatever.com')
	t.equal(mySession.getUserId(), 'misspelled@whatever.com', "the userId is what we set it to")

	var secondLoginKey = mySession.getLoginKey('theRightEmailAddress@stuff.com')
	t.equal(mySession.getUserId(), 'theRightEmailAddress@stuff.com', "the userId was updated correctly")

	mySession.logIn(firstLoginKey)
	t.notOk(mySession.isLoggedIn(), "the session is not logged in")

	mySession.logIn(secondLoginKey)
	t.ok(mySession.isLoggedIn(), "the session was logged in with the second login key")
	t.equal(mySession.getUserId(), 'theRightEmailAddress@stuff.com', "the session's userId is the same as what we set it to earlier")

	var thirdLoginKey = mySession.getLoginKey('someOtherEmailAddress@whatever.com')
	t.equal(mySession.getUserId(), 'someOtherEmailAddress@whatever.com', "The session's userId was changed even while it was logged in before")
	t.notOk(mySession.isLoggedIn(), "The session is not logged in after getting a new login key")
	mySession.logIn(thirdLoginKey)
	t.ok(mySession.isLoggedIn(), "The session is logged in with the new login key")

	t.end()
})

test("Only the most recent login key works", function(t) {
	var logOutAfterThisManySecondsOfInactivity = 5
	var loginKeysExpireAfterThisManySeconds = 5
	var sessions = new SessionManager(logOutAfterThisManySecondsOfInactivity, loginKeysExpireAfterThisManySeconds)

	var mySession = sessions.createSession()

	var firstLoginKey = mySession.getLoginKey('misspelled@whatever.com')
	t.equal(mySession.getUserId(), 'misspelled@whatever.com', "The userId was set successfully")

	var secondLoginKey = mySession.getLoginKey('misspelled@whatever.com')

	mySession.logIn(firstLoginKey)
	t.notOk(mySession.isLoggedIn(), "Logging in fails with an outdated login key")

	mySession.logIn(secondLoginKey)
	t.ok(mySession.isLoggedIn(), "Logging in succeeds with the latest login key")

	t.end()
})

test("Manual logging out", function(t) {
	var sessions = new SessionManager(5, 5)

	var mySession = sessions.createSession()

	var loginKey = mySession.getLoginKey('user')

	mySession.logIn(loginKey)
	t.ok(mySession.isLoggedIn(), 'Successfully logged in')
	mySession.logOut()
	t.notOk(mySession.isLoggedIn(), 'Successfully logged out')
	t.end()
})

test("Sessions going away after enough time without use", function(t) {
	var sessions = new SessionManager(5, 5, 3)

	var mySession = sessions.createSession()

	var loginKey = mySession.getLoginKey('user')

	setTimeout(function() {
		var session = sessions.getSession(mySession.getSessionKey())
		t.equal(typeof session, 'undefined', "The session doesn't exist after 4 seconds")
	}, 4000)

	var secondSession = sessions.createSession()

	setTimeout(function() {
		var session = sessions.getSession(secondSession.getSessionKey())
		t.equal(typeof session.getSessionKey, 'function')
		t.equal(session.getSessionKey(), secondSession.getSessionKey(), "Got back the same session after 2 seconds")

		setTimeout(function() {
			var session = sessions.getSession(secondSession.getSessionKey())
			t.equal(typeof session.getSessionKey, 'function')
			t.equal(session.getSessionKey(), secondSession.getSessionKey(), "Got back the same session after another 2 seconds")

			setTimeout(function() {
				var session = sessions.getSession(secondSession.getSessionKey())
				t.equal(typeof session, 'undefined', "Session does not exist 3.5 seconds after the last interaction")
				t.end()
			}, 3500)
		}, 2000)
	}, 2000)

})
