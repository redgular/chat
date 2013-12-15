'use strict';

(function() {
/**
 * Import all models ===============================================================================
 */
require('../app/models/message');
require('../app/models/user');

/**
 * Import helpers ==================================================================================
 */
var Twilio = require('../app/helpers/twilio');

/**
 * Module dependencies =============================================================================
 */
var mongoose = require('mongoose')
	, Message = mongoose.model('Message')
	, User = mongoose.model('User')
	, _ = require('underscore');

// Public functions. ===============================================================================
module.exports = function(app, io) {
	// API routes for Message model ==================================================================

	// * POST, add new user to mongodb.
	app.post('/api/user', function(req, res) {
		var first_name = req.body.firstName
		  , last_name = req.body.lastName
		  , phone_number = Twilio.standardizePhoneNumber(req.body.phoneNumber);

		User.findOne({ phone_number: phone_number }, function(err, user) {
			if (err) {
				res.send(err);
			};

			// If existing user is found.
			if (user) {
				res.json(user);
			} else {

				// If user is not found, then create a new one.
				User.create({
					first_name: first_name,
					last_name: last_name,
					phone_number: phone_number
				}, function(err, user) {
					if (err) {
						res.send(err);
					};

					// Load new user.
					res.json(user);
				});
			}
		})
	});

	// + GET all users and messages.
	app.get('/api/users', function(req, res) {
		User.getAllUsers(function(err, users) {
			Message.getMessagesFromUsers(users, function(err, data) {
				res.json(data);
			});
		});
	});

	// Get messages.
	app.get('/api/messages', function(req, res) {
		var my_phone_number = '+14158586858';

		// Use Mongoose to get all of the messages in the database.
		// Only get the Messages in Mongodb where the 'from' or 'to' matches your Twilio number.
		Message.find({ $or: [ {'to': my_phone_number}, {'from': my_phone_number} ] },
			function(err, messages) {
			if (err) {
				res.send(err);
			};
			res.json(messages);
		});

	});

	// Create a Message and send back all Messages.
	app.post('/api/message', function(req, res) {
		// Debugging purposes.
		console.log(JSON.stringify(req.body, null, 4));
		var my_phone_number = '+14158586858';

		// Message specific variables.
		var body = ''
		  , to   = ''
		  , from = '';

		if(typeof req.body.MessageSid !== "undefined") {
			// If Twilio is making the POST request, then this is an inbound SMS.
			body = req.body.Body;
			to = req.body.To;
			from = req.body.From;
		} else {
			// Else, this is a POST request from the client, an outbound SMS.
			body = req.body.body;
			to = req.body.to;
			// from = req.body;
			from = my_phone_number;

			// Send POST request to Twilio to initate outbound SMS.
			// To, From, Body
			Twilio.sendMessage(to, from, body);
		};

		// Save Message object to Mongodb.
		// Create a message; information comes from AJAX request from Angular
		Message.create({
			body : body,
			to : to,
			from : from
		}, function(err, message) {
			if (err) {
				res.send(err);
			};

			// Form array to hold phone numbers.
			var arr = [];
			arr.push(to, body);

			User.refreshLastUpdatedOn(arr, function(err, data) {
				console.log('updated records ' + data);

				// Retrieve Users data and send it back to the front end.
				User.getAllUsers(function(err, users) {
					Message.getMessagesFromUsers(users, function(err, data) {
						if(typeof req.body.MessageSid !== 'undefined') {
							io.sockets.emit('users', data);
						} else {
							console.log('send to front end');
							if (err) {
								res.json(err);
							};
							res.json(data);
						};
					});
				});
			});
		});
	});

	// Delete a Message.
	app.delete('/api/messages/:message_id', function(req, res) {
		Message.remove({
			_id : req.params.message_id
		}, function(err, message) {
			if (err) {
				res.send(err);
			};

			// Get and return all of the messages after the message is deleted.
			Message.find(function(err, message) {
				if (err) {
					res.send(err);
				};
				res.json(messages);
			});
		});
	});

	// Application route =============================================================================
	app.get('*', function(req, res) {
		// Load the single view file (Angular will handle the page changes).
		res.sendfile('index.html', {'root': './public/views/'});
	});
};

}());