if (!global.Intl) {
    global.Intl = require('intl'); // polyfill for `Intl`
}

var timers = {},
    chrono = require('chrono-node'),
    IntlRelativeFormat = require('intl-relativeformat'),
    rf = new IntlRelativeFormat($$.getLocale()),
    defaultQuestion = 'Which option?',

createVote = function(api, event, spl, date) {
    var person = event.sender_name.trim();

    var response = person + ' called a new vote:\n\n' + spl[0] + '\n\nThe options are:\n';

    exports.config[event.thread_id] = {
        question: spl[0],
        answers: [],
        answersText: [],
        votes: {},
        date: date
    };
    for (var i = 1; i < spl.length; i++) {
        response += i + '. ' + spl[i] + '\n';
        exports.config[event.thread_id].answers.push(i);
        exports.config[event.thread_id].answersText.push(spl[i]);
        exports.config[event.thread_id].votes[i - 1] = 0;
    }

    api.sendMessage(response, event.thread_id);

    let timeout = date - Date.now();
    if (timeout > Math.pow(2, 32) - 1) {
        timeout = -1;
        api.sendMessage(`Sorry vote cannot last this long, defaulting to infinite voting mode.\n Use ${api.commandPrefix}vote end or ${api.commandPrefix}vote cancel to complete the voting`);
    }
    if (timeout > 0) {
        api.sendMessage(`The vote will be over ${rf.format(date)}.`, event.thread_id);
        timers[event.thread_id] = setTimeout(function() {
            api.sendMessage('Vote over.', event.thread_id);
            print(api, event);
            clearTimeout(timers[event.thread_id]);
            delete exports.config[event.thread_id];
        }, date - Date.now());
    }
},

castVote = function(api, event, val) {
    var person = event.sender_name.trim();

    if (!exports.config[event.thread_id]) {
        api.sendMessage('No vote in progress. Stupid ' + person + '!', event.thread_id);
        return;
    }

    if (exports.config[event.thread_id].answers.indexOf(val) === -1) {
        api.sendMessage('I don\'t know what to say ' + person + ', that isn\'t even an option.', event.thread_id);
        return;
    }

    if (exports.config[event.thread_id][event.sender_id]) {
        api.sendMessage('No, ' + person + ', you cannot vote more than once. Maybe I should deduct some karma...', event.thread_id);
        return;
    }

    val--;

    exports.config[event.thread_id][event.sender_id] = true;
    exports.config[event.thread_id].votes[val]++;

    api.sendMessage('Vote cast.', event.thread_id);
},

isNumeric = function(n) {
    // http://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
    return !isNaN(parseFloat(n)) && isFinite(n);
},

print = function(api, event, printTimeRemaining=true) {
    if (!exports.config[event.thread_id]) {
        api.sendMessage('No votes in progress?', event.thread_id);
        return;
    }
    let votes = exports.config[event.thread_id].votes,
        answers = exports.config[event.thread_id].answersText,
        message = '',
        i = 0;

    for (var v in votes) {
        message += `${++i}. ${answers[v]} \t→ ${votes[v]}\n`;
    }
    let date = exports.config[event.thread_id].date;
    if (date > Date.now() && printTimeRemaining) {
        message += `\nThe vote will be over ${rf.format(date)}.`;
    }
    api.sendMessage(exports.config[event.thread_id].question + '\n', event.thread_id);
    api.sendMessage(message, event.thread_id);
},

end = (api, event, type, shouldPrint) => {
    if (!exports.config[event.thread_id]) {
        api.sendMessage(`Why did you think you could ${type} a vote when one hasn\'t been cast? Stupid ${event.sender_name.trim()}!`, event.thread_id);
    } else {
        clearTimeout(timers[event.thread_id]);
        if (shouldPrint) {
            print(api, event, false);
        }
        delete exports.config[event.thread_id];
        api.sendMessage('Vote finished.', event.thread_id);
    }
};

exports.run = function (api, event) {
    if (event.arguments.length === 1) {
        return print(api, event);
    }
    else if (event.arguments.length === 2) {
        if (isNumeric(event.arguments[1])) {
            return castVote(api, event, parseInt(event.arguments[1]));
        }
        else if (event.arguments[1] === 'cancel') {
            return end(api, event, 'cancel', false);
        }
        else if (event.arguments[1] === 'end') {
            return end(api, event, 'end', true);
        }
    }

    event.arguments.splice(0, 1);
    let timeout = 0,
        question = defaultQuestion;

    for (let i = 0 ; i < event.arguments.length - 1; i++) {
        if (event.arguments[i] === '-q') {
            if (question !== defaultQuestion) {
                api.sendMessage('Do you really think that having more than one question is good idea? Even I\'m confused by this prospect', event.thread_id);
                return;
            }
            question = event.arguments[i + 1];
            event.arguments.splice(i, 2);
            i--;
        }
        else if (event.arguments[i] === '-t') {
            if (timeout !== 0) {
                api.sendMessage('Do you really think that having more than one timeout is good idea? Even I\'m confused by this prospect', event.thread_id);
                return;
            }
            if (isNumeric(event.arguments[i + 1])) {
                timeout = new Date(parseInt(event.arguments[i + 1]) * 1000 + Date.now());
            }
            else {
                let chronoDate = chrono.parse(event.arguments[i + 1]);
                if (chronoDate[0]) {
                    let date = chronoDate[0].start.date();
                    timeout = date;
                }
                else {
                    api.sendMessage('Sorry I couldn\'t work out what date or time you ment.', event.thread_id);
                    return;
                }
            }
            if (timeout < Date.now()) {
                api.sendMessage('Do you really think that a time in the past is a good idea? I\'m  going to ignore you now.', event.thread_id);
                return;
            }
            event.arguments.splice(i, 2);
            i--;
        }
    }


    if (event.arguments.length < 2)  {
        return api.sendMessage('WTF are you doing????!', event.thread_id);
    }

    event.arguments.unshift(question);

    createVote(api, event, event.arguments, timeout);
};

exports.unload = function() {
    for(let timer in timers) {
        clearTimeout(timers[timer]);
    }
};
