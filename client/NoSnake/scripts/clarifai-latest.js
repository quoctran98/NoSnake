/**
 * Clarifai JavaScript SDK v2.9.0
 *
 * Last updated: Thu Oct 18 2018 18:03:13 GMT+0000 (Coordinated Universal Time)
 *
 * Visit https://developer.clarifai.com
 *
 * Copyright (c) 2016-present, Clarifai, Inc.
 * All rights reserved.
 * Licensed under the Apache License, Version 2.0.
 *
 * The source tree of this library can be found at
 *   https://github.com/Clarifai/clarifai-javascript
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

// rawAsap provides everything we need except exception management.
var rawAsap = require("./raw");
// RawTasks are recycled to reduce GC churn.
var freeTasks = [];
// We queue errors to ensure they are thrown in right order (FIFO).
// Array-as-queue is good enough here, since we are just dealing with exceptions.
var pendingErrors = [];
var requestErrorThrow = rawAsap.makeRequestCallFromTimer(throwFirstError);

function throwFirstError() {
    if (pendingErrors.length) {
        throw pendingErrors.shift();
    }
}

/**
 * Calls a task as soon as possible after returning, in its own event, with priority
 * over other events like animation, reflow, and repaint. An error thrown from an
 * event will not interrupt, nor even substantially slow down the processing of
 * other events, but will be rather postponed to a lower priority event.
 * @param {{call}} task A callable object, typically a function that takes no
 * arguments.
 */
module.exports = asap;
function asap(task) {
    var rawTask;
    if (freeTasks.length) {
        rawTask = freeTasks.pop();
    } else {
        rawTask = new RawTask();
    }
    rawTask.task = task;
    rawAsap(rawTask);
}

// We wrap tasks with recyclable task objects.  A task object implements
// `call`, just like a function.
function RawTask() {
    this.task = null;
}

// The sole purpose of wrapping the task is to catch the exception and recycle
// the task object after its single use.
RawTask.prototype.call = function () {
    try {
        this.task.call();
    } catch (error) {
        if (asap.onerror) {
            // This hook exists purely for testing purposes.
            // Its name will be periodically randomized to break any code that
            // depends on its existence.
            asap.onerror(error);
        } else {
            // In a web browser, exceptions are not fatal. However, to avoid
            // slowing down the queue of pending tasks, we rethrow the error in a
            // lower priority turn.
            pendingErrors.push(error);
            requestErrorThrow();
        }
    } finally {
        this.task = null;
        freeTasks[freeTasks.length] = this;
    }
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/browser-asap.js","/../node_modules/asap")
},{"./raw":2,"buffer":23,"pBGvAp":27}],2:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including IO, animation, reflow, and redraw
// events in browsers.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Equivalent to push, but avoids a function call.
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// `requestFlush` is an implementation-specific method that attempts to kick
// off a `flush` event as quickly as possible. `flush` will attempt to exhaust
// the event queue before yielding to the browser's own event loop.
var requestFlush;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grow
// unbounded. To prevent memory exhaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

// `requestFlush` is implemented using a strategy based on data collected from
// every available SauceLabs Selenium web driver worker at time of writing.
// https://docs.google.com/spreadsheets/d/1mG-5UYGup5qxGdEMWkhP6BWCz053NUb2E1QoUTU16uA/edit#gid=783724593

// Safari 6 and 6.1 for desktop, iPad, and iPhone are the only browsers that
// have WebKitMutationObserver but not un-prefixed MutationObserver.
// Must use `global` or `self` instead of `window` to work in both frames and web
// workers. `global` is a provision of Browserify, Mr, Mrs, or Mop.

/* globals self */
var scope = typeof global !== "undefined" ? global : self;
var BrowserMutationObserver = scope.MutationObserver || scope.WebKitMutationObserver;

// MutationObservers are desirable because they have high priority and work
// reliably everywhere they are implemented.
// They are implemented in all modern browsers.
//
// - Android 4-4.3
// - Chrome 26-34
// - Firefox 14-29
// - Internet Explorer 11
// - iPad Safari 6-7.1
// - iPhone Safari 7-7.1
// - Safari 6-7
if (typeof BrowserMutationObserver === "function") {
    requestFlush = makeRequestCallFromMutationObserver(flush);

// MessageChannels are desirable because they give direct access to the HTML
// task queue, are implemented in Internet Explorer 10, Safari 5.0-1, and Opera
// 11-12, and in web workers in many engines.
// Although message channels yield to any queued rendering and IO tasks, they
// would be better than imposing the 4ms delay of timers.
// However, they do not work reliably in Internet Explorer or Safari.

// Internet Explorer 10 is the only browser that has setImmediate but does
// not have MutationObservers.
// Although setImmediate yields to the browser's renderer, it would be
// preferrable to falling back to setTimeout since it does not have
// the minimum 4ms penalty.
// Unfortunately there appears to be a bug in Internet Explorer 10 Mobile (and
// Desktop to a lesser extent) that renders both setImmediate and
// MessageChannel useless for the purposes of ASAP.
// https://github.com/kriskowal/q/issues/396

// Timers are implemented universally.
// We fall back to timers in workers in most engines, and in foreground
// contexts in the following browsers.
// However, note that even this simple case requires nuances to operate in a
// broad spectrum of browsers.
//
// - Firefox 3-13
// - Internet Explorer 6-9
// - iPad Safari 4.3
// - Lynx 2.8.7
} else {
    requestFlush = makeRequestCallFromTimer(flush);
}

// `requestFlush` requests that the high priority event queue be flushed as
// soon as possible.
// This is useful to prevent an error thrown in a task from stalling the event
// queue if the exception handled by Node.js’s
// `process.on("uncaughtException")` or by a domain.
rawAsap.requestFlush = requestFlush;

// To request a high priority event, we induce a mutation observer by toggling
// the text of a text node between "1" and "-1".
function makeRequestCallFromMutationObserver(callback) {
    var toggle = 1;
    var observer = new BrowserMutationObserver(callback);
    var node = document.createTextNode("");
    observer.observe(node, {characterData: true});
    return function requestCall() {
        toggle = -toggle;
        node.data = toggle;
    };
}

// The message channel technique was discovered by Malte Ubl and was the
// original foundation for this library.
// http://www.nonblocking.io/2011/06/windownexttick.html

// Safari 6.0.5 (at least) intermittently fails to create message ports on a
// page's first load. Thankfully, this version of Safari supports
// MutationObservers, so we don't need to fall back in that case.

// function makeRequestCallFromMessageChannel(callback) {
//     var channel = new MessageChannel();
//     channel.port1.onmessage = callback;
//     return function requestCall() {
//         channel.port2.postMessage(0);
//     };
// }

// For reasons explained above, we are also unable to use `setImmediate`
// under any circumstances.
// Even if we were, there is another bug in Internet Explorer 10.
// It is not sufficient to assign `setImmediate` to `requestFlush` because
// `setImmediate` must be called *by name* and therefore must be wrapped in a
// closure.
// Never forget.

// function makeRequestCallFromSetImmediate(callback) {
//     return function requestCall() {
//         setImmediate(callback);
//     };
// }

// Safari 6.0 has a problem where timers will get lost while the user is
// scrolling. This problem does not impact ASAP because Safari 6.0 supports
// mutation observers, so that implementation is used instead.
// However, if we ever elect to use timers in Safari, the prevalent work-around
// is to add a scroll event listener that calls for a flush.

// `setTimeout` does not call the passed callback if the delay is less than
// approximately 7 in web workers in Firefox 8 through 18, and sometimes not
// even then.

function makeRequestCallFromTimer(callback) {
    return function requestCall() {
        // We dispatch a timeout with a specified delay of 0 for engines that
        // can reliably accommodate that request. This will usually be snapped
        // to a 4 milisecond delay, but once we're flushing, there's no delay
        // between events.
        var timeoutHandle = setTimeout(handleTimer, 0);
        // However, since this timer gets frequently dropped in Firefox
        // workers, we enlist an interval handle that will try to fire
        // an event 20 times per second until it succeeds.
        var intervalHandle = setInterval(handleTimer, 50);

        function handleTimer() {
            // Whichever timer succeeds will cancel both timers and
            // execute the callback.
            clearTimeout(timeoutHandle);
            clearInterval(intervalHandle);
            callback();
        }
    };
}

// This is for `asap.js` only.
// Its name will be periodically randomized to break any code that depends on
// its existence.
rawAsap.makeRequestCallFromTimer = makeRequestCallFromTimer;

// ASAP was originally a nextTick shim included in Q. This was factored out
// into this ASAP package. It was later adapted to RSVP which made further
// amendments. These decisions, particularly to marginalize MessageChannel and
// to capture the MutationObserver implementation in a closure, were integrated
// back into ASAP proper.
// https://github.com/tildeio/rsvp.js/blob/cddf7232546a9cf858524b75cde6f9edf72620a7/lib/rsvp/asap.js

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/browser-raw.js","/../node_modules/asap")
},{"buffer":23,"pBGvAp":27}],3:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

var domain; // The domain module is executed on demand
var hasSetImmediate = typeof setImmediate === "function";

// Use the fastest means possible to execute a task in its own turn, with
// priority over other events including network IO events in Node.js.
//
// An exception thrown by a task will permanently interrupt the processing of
// subsequent tasks. The higher level `asap` function ensures that if an
// exception is thrown by a task, that the task queue will continue flushing as
// soon as possible, but if you use `rawAsap` directly, you are responsible to
// either ensure that no exceptions are thrown from your task, or to manually
// call `rawAsap.requestFlush` if an exception is thrown.
module.exports = rawAsap;
function rawAsap(task) {
    if (!queue.length) {
        requestFlush();
        flushing = true;
    }
    // Avoids a function call
    queue[queue.length] = task;
}

var queue = [];
// Once a flush has been requested, no further calls to `requestFlush` are
// necessary until the next `flush` completes.
var flushing = false;
// The position of the next task to execute in the task queue. This is
// preserved between calls to `flush` so that it can be resumed if
// a task throws an exception.
var index = 0;
// If a task schedules additional tasks recursively, the task queue can grow
// unbounded. To prevent memory excaustion, the task queue will periodically
// truncate already-completed tasks.
var capacity = 1024;

// The flush function processes all tasks that have been scheduled with
// `rawAsap` unless and until one of those tasks throws an exception.
// If a task throws an exception, `flush` ensures that its state will remain
// consistent and will resume where it left off when called again.
// However, `flush` does not make any arrangements to be called again if an
// exception is thrown.
function flush() {
    while (index < queue.length) {
        var currentIndex = index;
        // Advance the index before calling the task. This ensures that we will
        // begin flushing on the next task the task throws an error.
        index = index + 1;
        queue[currentIndex].call();
        // Prevent leaking memory for long chains of recursive calls to `asap`.
        // If we call `asap` within tasks scheduled by `asap`, the queue will
        // grow, but to avoid an O(n) walk for every task we execute, we don't
        // shift tasks off the queue after they have been executed.
        // Instead, we periodically shift 1024 tasks off the queue.
        if (index > capacity) {
            // Manually shift all values starting at the index back to the
            // beginning of the queue.
            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                queue[scan] = queue[scan + index];
            }
            queue.length -= index;
            index = 0;
        }
    }
    queue.length = 0;
    index = 0;
    flushing = false;
}

rawAsap.requestFlush = requestFlush;
function requestFlush() {
    // Ensure flushing is not bound to any domain.
    // It is not sufficient to exit the domain, because domains exist on a stack.
    // To execute code outside of any domain, the following dance is necessary.
    var parentDomain = process.domain;
    if (parentDomain) {
        if (!domain) {
            // Lazy execute the domain module.
            // Only employed if the user elects to use domains.
            domain = require("domain");
        }
        domain.active = process.domain = null;
    }

    // `setImmediate` is slower that `process.nextTick`, but `process.nextTick`
    // cannot handle recursion.
    // `requestFlush` will only be called recursively from `asap.js`, to resume
    // flushing after an error is thrown into a domain.
    // Conveniently, `setImmediate` was introduced in the same version
    // `process.nextTick` started throwing recursion errors.
    if (flushing && hasSetImmediate) {
        setImmediate(flush);
    } else {
        process.nextTick(flush);
    }

    if (parentDomain) {
        domain.active = process.domain = parentDomain;
    }
}

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/asap/raw.js","/../node_modules/asap")
},{"buffer":23,"domain":25,"pBGvAp":27}],4:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
module.exports = require('./lib/axios');
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/index.js","/../node_modules/axios")
},{"./lib/axios":6,"buffer":23,"pBGvAp":27}],5:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var transformData = require('./../helpers/transformData');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var btoa = (typeof window !== 'undefined' && window.btoa) || require('./../helpers/btoa');
var settle = require('../helpers/settle');

module.exports = function xhrAdapter(resolve, reject, config) {
  var requestData = config.data;
  var requestHeaders = config.headers;

  if (utils.isFormData(requestData)) {
    delete requestHeaders['Content-Type']; // Let the browser set it
  }

  var request = new XMLHttpRequest();
  var loadEvent = 'onreadystatechange';
  var xDomain = false;

  // For IE 8/9 CORS support
  // Only supports POST and GET calls and doesn't returns the response headers.
  // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
  if (process.env.NODE_ENV !== 'test' && typeof window !== 'undefined' && window.XDomainRequest && !('withCredentials' in request) && !isURLSameOrigin(config.url)) {
    request = new window.XDomainRequest();
    loadEvent = 'onload';
    xDomain = true;
    request.onprogress = function handleProgress() {};
    request.ontimeout = function handleTimeout() {};
  }

  // HTTP basic authentication
  if (config.auth) {
    var username = config.auth.username || '';
    var password = config.auth.password || '';
    requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
  }

  request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

  // Set the request timeout in MS
  request.timeout = config.timeout;

  // Listen for ready state
  request[loadEvent] = function handleLoad() {
    if (!request || (request.readyState !== 4 && !xDomain)) {
      return;
    }

    // The request errored out and we didn't get a response, this will be
    // handled by onerror instead
    if (request.status === 0) {
      return;
    }

    // Prepare the response
    var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
    var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
    var response = {
      data: transformData(
        responseData,
        responseHeaders,
        config.transformResponse
      ),
      // IE sends 1223 instead of 204 (https://github.com/mzabriskie/axios/issues/201)
      status: request.status === 1223 ? 204 : request.status,
      statusText: request.status === 1223 ? 'No Content' : request.statusText,
      headers: responseHeaders,
      config: config,
      request: request
    };

    settle(resolve, reject, response);

    // Clean up request
    request = null;
  };

  // Handle low level network errors
  request.onerror = function handleError() {
    // Real errors are hidden from us by the browser
    // onerror should only fire if it's a network error
    reject(new Error('Network Error'));

    // Clean up request
    request = null;
  };

  // Handle timeout
  request.ontimeout = function handleTimeout() {
    var err = new Error('timeout of ' + config.timeout + 'ms exceeded');
    err.timeout = config.timeout;
    err.code = 'ECONNABORTED';
    reject(err);

    // Clean up request
    request = null;
  };

  // Add xsrf header
  // This is only done if running in a standard browser environment.
  // Specifically not if we're in a web worker, or react-native.
  if (utils.isStandardBrowserEnv()) {
    var cookies = require('./../helpers/cookies');

    // Add xsrf header
    var xsrfValue = config.withCredentials || isURLSameOrigin(config.url) ?
        cookies.read(config.xsrfCookieName) :
        undefined;

    if (xsrfValue) {
      requestHeaders[config.xsrfHeaderName] = xsrfValue;
    }
  }

  // Add headers to the request
  if ('setRequestHeader' in request) {
    utils.forEach(requestHeaders, function setRequestHeader(val, key) {
      if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
        // Remove Content-Type if data is undefined
        delete requestHeaders[key];
      } else {
        // Otherwise add header to the request
        request.setRequestHeader(key, val);
      }
    });
  }

  // Add withCredentials to request if needed
  if (config.withCredentials) {
    request.withCredentials = true;
  }

  // Add responseType to request if needed
  if (config.responseType) {
    try {
      request.responseType = config.responseType;
    } catch (e) {
      if (request.responseType !== 'json') {
        throw e;
      }
    }
  }

  // Handle progress if needed
  if (config.progress) {
    if (config.method === 'post' || config.method === 'put') {
      request.upload.addEventListener('progress', config.progress);
    } else if (config.method === 'get') {
      request.addEventListener('progress', config.progress);
    }
  }

  if (requestData === undefined) {
    requestData = null;
  }

  // Send the request
  request.send(requestData);
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/adapters/xhr.js","/../node_modules/axios/lib/adapters")
},{"../helpers/settle":18,"./../helpers/btoa":11,"./../helpers/buildURL":12,"./../helpers/cookies":14,"./../helpers/isURLSameOrigin":16,"./../helpers/parseHeaders":17,"./../helpers/transformData":20,"./../utils":21,"buffer":23,"pBGvAp":27}],6:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var defaults = require('./defaults');
var utils = require('./utils');
var dispatchRequest = require('./core/dispatchRequest');
var InterceptorManager = require('./core/InterceptorManager');
var isAbsoluteURL = require('./helpers/isAbsoluteURL');
var combineURLs = require('./helpers/combineURLs');
var bind = require('./helpers/bind');
var transformData = require('./helpers/transformData');

function Axios(defaultConfig) {
  this.defaults = utils.merge({}, defaultConfig);
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, this.defaults, { method: 'get' }, config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Don't allow overriding defaults.withCredentials
  config.withCredentials = config.withCredentials || this.defaults.withCredentials;

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

var defaultInstance = new Axios(defaults);
var axios = module.exports = bind(Axios.prototype.request, defaultInstance);
module.exports.Axios = Axios;

// Expose properties from defaultInstance
axios.defaults = defaultInstance.defaults;
axios.interceptors = defaultInstance.interceptors;

// Factory for creating new instances
axios.create = function create(defaultConfig) {
  return new Axios(defaultConfig);
};

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
  axios[method] = bind(Axios.prototype[method], defaultInstance);
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
  axios[method] = bind(Axios.prototype[method], defaultInstance);
});

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/axios.js","/../node_modules/axios/lib")
},{"./core/InterceptorManager":7,"./core/dispatchRequest":8,"./defaults":9,"./helpers/bind":10,"./helpers/combineURLs":13,"./helpers/isAbsoluteURL":15,"./helpers/spread":19,"./helpers/transformData":20,"./utils":21,"buffer":23,"pBGvAp":27}],7:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/InterceptorManager.js","/../node_modules/axios/lib/core")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],8:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Dispatch a request to the server using whichever adapter
 * is supported by the current environment.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  return new Promise(function executor(resolve, reject) {
    try {
      var adapter;

      if (typeof config.adapter === 'function') {
        // For custom adapter support
        adapter = config.adapter;
      } else if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = require('../adapters/xhr');
      } else if (typeof process !== 'undefined') {
        // For node use HTTP adapter
        adapter = require('../adapters/http');
      }

      if (typeof adapter === 'function') {
        adapter(resolve, reject, config);
      }
    } catch (e) {
      reject(e);
    }
  });
};


}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/core/dispatchRequest.js","/../node_modules/axios/lib/core")
},{"../adapters/http":5,"../adapters/xhr":5,"buffer":23,"pBGvAp":27}],9:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./utils');

var PROTECTION_PREFIX = /^\)\]\}',?\n/;
var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

module.exports = {
  transformRequest: [function transformRequest(data, headers) {
    if (utils.isFormData(data) || utils.isArrayBuffer(data) || utils.isStream(data)) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isObject(data) && !utils.isFile(data) && !utils.isBlob(data)) {
      // Set application/json if no Content-Type has been specified
      if (!utils.isUndefined(headers)) {
        utils.forEach(headers, function processContentTypeHeader(val, key) {
          if (key.toLowerCase() === 'content-type') {
            headers['Content-Type'] = val;
          }
        });

        if (utils.isUndefined(headers['Content-Type'])) {
          headers['Content-Type'] = 'application/json;charset=utf-8';
        }
      }
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      data = data.replace(PROTECTION_PREFIX, '');
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    },
    patch: utils.merge(DEFAULT_CONTENT_TYPE),
    post: utils.merge(DEFAULT_CONTENT_TYPE),
    put: utils.merge(DEFAULT_CONTENT_TYPE)
  },

  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/defaults.js","/../node_modules/axios/lib")
},{"./utils":21,"buffer":23,"pBGvAp":27}],10:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/bind.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],11:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function E() {
  this.message = 'String contains an invalid character';
}
E.prototype = new Error;
E.prototype.code = 5;
E.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new E();
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/btoa.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],12:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      }

      if (!utils.isArray(val)) {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};


}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/buildURL.js","/../node_modules/axios/lib/helpers")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],13:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '');
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/combineURLs.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],14:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/cookies.js","/../node_modules/axios/lib/helpers")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],15:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/isAbsoluteURL.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],16:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/isURLSameOrigin.js","/../node_modules/axios/lib/helpers")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],17:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  return parsed;
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/parseHeaders.js","/../node_modules/axios/lib/helpers")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],18:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  // Note: status is not exposed by XDomainRequest
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(response);
  }
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/settle.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],19:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/spread.js","/../node_modules/axios/lib/helpers")
},{"buffer":23,"pBGvAp":27}],20:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/helpers/transformData.js","/../node_modules/axios/lib/helpers")
},{"./../utils":21,"buffer":23,"pBGvAp":27}],21:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  typeof document.createElement -> undefined
 */
function isStandardBrowserEnv() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object' && !isArray(obj)) {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  trim: trim
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/axios/lib/utils.js","/../node_modules/axios/lib")
},{"buffer":23,"pBGvAp":27}],22:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/browserify/node_modules/base64-js/lib/b64.js","/../node_modules/browserify/node_modules/base64-js/lib")
},{"buffer":23,"pBGvAp":27}],23:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/browserify/node_modules/buffer/index.js","/../node_modules/browserify/node_modules/buffer")
},{"base64-js":22,"buffer":23,"ieee754":26,"pBGvAp":27}],24:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/browserify/node_modules/events/events.js","/../node_modules/browserify/node_modules/events")
},{"buffer":23,"pBGvAp":27}],25:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// This file should be ES5 compatible
/* eslint prefer-spread:0, no-var:0, prefer-reflect:0, no-magic-numbers:0 */
'use strict'
module.exports = (function () {
	// Import Events
	var events = require('events')

	// Export Domain
	var domain = {}
	domain.createDomain = domain.create = function () {
		var d = new events.EventEmitter()

		function emitError (e) {
			d.emit('error', e)
		}

		d.add = function (emitter) {
			emitter.on('error', emitError)
		}
		d.remove = function (emitter) {
			emitter.removeListener('error', emitError)
		}
		d.bind = function (fn) {
			return function () {
				var args = Array.prototype.slice.call(arguments)
				try {
					fn.apply(null, args)
				}
				catch (err) {
					emitError(err)
				}
			}
		}
		d.intercept = function (fn) {
			return function (err) {
				if ( err ) {
					emitError(err)
				}
				else {
					var args = Array.prototype.slice.call(arguments, 1)
					try {
						fn.apply(null, args)
					}
					catch (err) {
						emitError(err)
					}
				}
			}
		}
		d.run = function (fn) {
			try {
				fn()
			}
			catch (err) {
				emitError(err)
			}
			return this
		}
		d.dispose = function () {
			this.removeAllListeners()
			return this
		}
		d.enter = d.exit = function () {
			return this
		}
		return d
	}
	return domain
}).call(this)

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/domain-browser/index.js","/../node_modules/domain-browser")
},{"buffer":23,"events":24,"pBGvAp":27}],26:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/ieee754/index.js","/../node_modules/ieee754")
},{"buffer":23,"pBGvAp":27}],27:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/process/browser.js","/../node_modules/process")
},{"buffer":23,"pBGvAp":27}],28:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = require('./lib')

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/index.js","/../node_modules/promise")
},{"./lib":33,"buffer":23,"pBGvAp":27}],29:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var asap = require('asap/raw');

function noop() {}

// States:
//
// 0 - pending
// 1 - fulfilled with _value
// 2 - rejected with _value
// 3 - adopted the state of another promise, _value
//
// once the state is no longer pending (0) it is immutable

// All `_` prefixed properties will be reduced to `_{random number}`
// at build time to obfuscate them and discourage their use.
// We don't use symbols or Object.defineProperty to fully hide them
// because the performance isn't good enough.


// to avoid using try/catch inside critical functions, we
// extract them to here.
var LAST_ERROR = null;
var IS_ERROR = {};
function getThen(obj) {
  try {
    return obj.then;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

function tryCallOne(fn, a) {
  try {
    return fn(a);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}
function tryCallTwo(fn, a, b) {
  try {
    fn(a, b);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
}

module.exports = Promise;

function Promise(fn) {
  if (typeof this !== 'object') {
    throw new TypeError('Promises must be constructed via new');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Promise constructor\'s argument is not a function');
  }
  this._40 = 0;
  this._65 = 0;
  this._55 = null;
  this._72 = null;
  if (fn === noop) return;
  doResolve(fn, this);
}
Promise._37 = null;
Promise._87 = null;
Promise._61 = noop;

Promise.prototype.then = function(onFulfilled, onRejected) {
  if (this.constructor !== Promise) {
    return safeThen(this, onFulfilled, onRejected);
  }
  var res = new Promise(noop);
  handle(this, new Handler(onFulfilled, onRejected, res));
  return res;
};

function safeThen(self, onFulfilled, onRejected) {
  return new self.constructor(function (resolve, reject) {
    var res = new Promise(noop);
    res.then(resolve, reject);
    handle(self, new Handler(onFulfilled, onRejected, res));
  });
}
function handle(self, deferred) {
  while (self._65 === 3) {
    self = self._55;
  }
  if (Promise._37) {
    Promise._37(self);
  }
  if (self._65 === 0) {
    if (self._40 === 0) {
      self._40 = 1;
      self._72 = deferred;
      return;
    }
    if (self._40 === 1) {
      self._40 = 2;
      self._72 = [self._72, deferred];
      return;
    }
    self._72.push(deferred);
    return;
  }
  handleResolved(self, deferred);
}

function handleResolved(self, deferred) {
  asap(function() {
    var cb = self._65 === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      if (self._65 === 1) {
        resolve(deferred.promise, self._55);
      } else {
        reject(deferred.promise, self._55);
      }
      return;
    }
    var ret = tryCallOne(cb, self._55);
    if (ret === IS_ERROR) {
      reject(deferred.promise, LAST_ERROR);
    } else {
      resolve(deferred.promise, ret);
    }
  });
}
function resolve(self, newValue) {
  // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
  if (newValue === self) {
    return reject(
      self,
      new TypeError('A promise cannot be resolved with itself.')
    );
  }
  if (
    newValue &&
    (typeof newValue === 'object' || typeof newValue === 'function')
  ) {
    var then = getThen(newValue);
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR);
    }
    if (
      then === self.then &&
      newValue instanceof Promise
    ) {
      self._65 = 3;
      self._55 = newValue;
      finale(self);
      return;
    } else if (typeof then === 'function') {
      doResolve(then.bind(newValue), self);
      return;
    }
  }
  self._65 = 1;
  self._55 = newValue;
  finale(self);
}

function reject(self, newValue) {
  self._65 = 2;
  self._55 = newValue;
  if (Promise._87) {
    Promise._87(self, newValue);
  }
  finale(self);
}
function finale(self) {
  if (self._40 === 1) {
    handle(self, self._72);
    self._72 = null;
  }
  if (self._40 === 2) {
    for (var i = 0; i < self._72.length; i++) {
      handle(self, self._72[i]);
    }
    self._72 = null;
  }
}

function Handler(onFulfilled, onRejected, promise){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
  this.onRejected = typeof onRejected === 'function' ? onRejected : null;
  this.promise = promise;
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, promise) {
  var done = false;
  var res = tryCallTwo(fn, function (value) {
    if (done) return;
    done = true;
    resolve(promise, value);
  }, function (reason) {
    if (done) return;
    done = true;
    reject(promise, reason);
  });
  if (!done && res === IS_ERROR) {
    done = true;
    reject(promise, LAST_ERROR);
  }
}

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/core.js","/../node_modules/promise/lib")
},{"asap/raw":3,"buffer":23,"pBGvAp":27}],30:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this;
  self.then(null, function (err) {
    setTimeout(function () {
      throw err;
    }, 0);
  });
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/done.js","/../node_modules/promise/lib")
},{"./core.js":29,"buffer":23,"pBGvAp":27}],31:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

//This file contains the ES6 extensions to the core Promises/A+ API

var Promise = require('./core.js');

module.exports = Promise;

/* Static Functions */

var TRUE = valuePromise(true);
var FALSE = valuePromise(false);
var NULL = valuePromise(null);
var UNDEFINED = valuePromise(undefined);
var ZERO = valuePromise(0);
var EMPTYSTRING = valuePromise('');

function valuePromise(value) {
  var p = new Promise(Promise._61);
  p._65 = 1;
  p._55 = value;
  return p;
}
Promise.resolve = function (value) {
  if (value instanceof Promise) return value;

  if (value === null) return NULL;
  if (value === undefined) return UNDEFINED;
  if (value === true) return TRUE;
  if (value === false) return FALSE;
  if (value === 0) return ZERO;
  if (value === '') return EMPTYSTRING;

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then;
      if (typeof then === 'function') {
        return new Promise(then.bind(value));
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex);
      });
    }
  }
  return valuePromise(value);
};

Promise.all = function (arr) {
  var args = Array.prototype.slice.call(arr);

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([]);
    var remaining = args.length;
    function res(i, val) {
      if (val && (typeof val === 'object' || typeof val === 'function')) {
        if (val instanceof Promise && val.then === Promise.prototype.then) {
          while (val._65 === 3) {
            val = val._55;
          }
          if (val._65 === 1) return res(i, val._55);
          if (val._65 === 2) reject(val._55);
          val.then(function (val) {
            res(i, val);
          }, reject);
          return;
        } else {
          var then = val.then;
          if (typeof then === 'function') {
            var p = new Promise(then.bind(val));
            p.then(function (val) {
              res(i, val);
            }, reject);
            return;
          }
        }
      }
      args[i] = val;
      if (--remaining === 0) {
        resolve(args);
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i]);
    }
  });
};

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) {
    reject(value);
  });
};

Promise.race = function (values) {
  return new Promise(function (resolve, reject) {
    values.forEach(function(value){
      Promise.resolve(value).then(resolve, reject);
    });
  });
};

/* Prototype Methods */

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/es6-extensions.js","/../node_modules/promise/lib")
},{"./core.js":29,"buffer":23,"pBGvAp":27}],32:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.prototype['finally'] = function (f) {
  return this.then(function (value) {
    return Promise.resolve(f()).then(function () {
      return value;
    });
  }, function (err) {
    return Promise.resolve(f()).then(function () {
      throw err;
    });
  });
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/finally.js","/../node_modules/promise/lib")
},{"./core.js":29,"buffer":23,"pBGvAp":27}],33:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

module.exports = require('./core.js');
require('./done.js');
require('./finally.js');
require('./es6-extensions.js');
require('./node-extensions.js');
require('./synchronous.js');

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/index.js","/../node_modules/promise/lib")
},{"./core.js":29,"./done.js":30,"./es6-extensions.js":31,"./finally.js":32,"./node-extensions.js":34,"./synchronous.js":35,"buffer":23,"pBGvAp":27}],34:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

// This file contains then/promise specific extensions that are only useful
// for node.js interop

var Promise = require('./core.js');
var asap = require('asap');

module.exports = Promise;

/* Static Functions */

Promise.denodeify = function (fn, argumentCount) {
  if (
    typeof argumentCount === 'number' && argumentCount !== Infinity
  ) {
    return denodeifyWithCount(fn, argumentCount);
  } else {
    return denodeifyWithoutCount(fn);
  }
};

var callbackFn = (
  'function (err, res) {' +
  'if (err) { rj(err); } else { rs(res); }' +
  '}'
);
function denodeifyWithCount(fn, argumentCount) {
  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('a' + i);
  }
  var body = [
    'return function (' + args.join(',') + ') {',
    'var self = this;',
    'return new Promise(function (rs, rj) {',
    'var res = fn.call(',
    ['self'].concat(args).concat([callbackFn]).join(','),
    ');',
    'if (res &&',
    '(typeof res === "object" || typeof res === "function") &&',
    'typeof res.then === "function"',
    ') {rs(res);}',
    '});',
    '};'
  ].join('');
  return Function(['Promise', 'fn'], body)(Promise, fn);
}
function denodeifyWithoutCount(fn) {
  var fnLength = Math.max(fn.length - 1, 3);
  var args = [];
  for (var i = 0; i < fnLength; i++) {
    args.push('a' + i);
  }
  var body = [
    'return function (' + args.join(',') + ') {',
    'var self = this;',
    'var args;',
    'var argLength = arguments.length;',
    'if (arguments.length > ' + fnLength + ') {',
    'args = new Array(arguments.length + 1);',
    'for (var i = 0; i < arguments.length; i++) {',
    'args[i] = arguments[i];',
    '}',
    '}',
    'return new Promise(function (rs, rj) {',
    'var cb = ' + callbackFn + ';',
    'var res;',
    'switch (argLength) {',
    args.concat(['extra']).map(function (_, index) {
      return (
        'case ' + (index) + ':' +
        'res = fn.call(' + ['self'].concat(args.slice(0, index)).concat('cb').join(',') + ');' +
        'break;'
      );
    }).join(''),
    'default:',
    'args[argLength] = cb;',
    'res = fn.apply(self, args);',
    '}',
    
    'if (res &&',
    '(typeof res === "object" || typeof res === "function") &&',
    'typeof res.then === "function"',
    ') {rs(res);}',
    '});',
    '};'
  ].join('');

  return Function(
    ['Promise', 'fn'],
    body
  )(Promise, fn);
}

Promise.nodeify = function (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var callback =
      typeof args[args.length - 1] === 'function' ? args.pop() : null;
    var ctx = this;
    try {
      return fn.apply(this, arguments).nodeify(callback, ctx);
    } catch (ex) {
      if (callback === null || typeof callback == 'undefined') {
        return new Promise(function (resolve, reject) {
          reject(ex);
        });
      } else {
        asap(function () {
          callback.call(ctx, ex);
        })
      }
    }
  }
};

Promise.prototype.nodeify = function (callback, ctx) {
  if (typeof callback != 'function') return this;

  this.then(function (value) {
    asap(function () {
      callback.call(ctx, null, value);
    });
  }, function (err) {
    asap(function () {
      callback.call(ctx, err);
    });
  });
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/node-extensions.js","/../node_modules/promise/lib")
},{"./core.js":29,"asap":1,"buffer":23,"pBGvAp":27}],35:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var Promise = require('./core.js');

module.exports = Promise;
Promise.enableSynchronous = function () {
  Promise.prototype.isPending = function() {
    return this.getState() == 0;
  };

  Promise.prototype.isFulfilled = function() {
    return this.getState() == 1;
  };

  Promise.prototype.isRejected = function() {
    return this.getState() == 2;
  };

  Promise.prototype.getValue = function () {
    if (this._65 === 3) {
      return this._55.getValue();
    }

    if (!this.isFulfilled()) {
      throw new Error('Cannot get a value of an unfulfilled promise.');
    }

    return this._55;
  };

  Promise.prototype.getReason = function () {
    if (this._65 === 3) {
      return this._55.getReason();
    }

    if (!this.isRejected()) {
      throw new Error('Cannot get a rejection reason of a non-rejected promise.');
    }

    return this._55;
  };

  Promise.prototype.getState = function () {
    if (this._65 === 3) {
      return this._55.getState();
    }
    if (this._65 === -1 || this._65 === -2) {
      return 0;
    }

    return this._65;
  };
};

Promise.disableSynchronous = function() {
  Promise.prototype.isPending = undefined;
  Promise.prototype.isFulfilled = undefined;
  Promise.prototype.isRejected = undefined;
  Promise.prototype.getValue = undefined;
  Promise.prototype.getReason = undefined;
  Promise.prototype.getState = undefined;
};

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/promise/lib/synchronous.js","/../node_modules/promise/lib")
},{"./core.js":29,"buffer":23,"pBGvAp":27}],36:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
(function(module) {
    'use strict';

    module.exports.is_uri = is_iri;
    module.exports.is_http_uri = is_http_iri;
    module.exports.is_https_uri = is_https_iri;
    module.exports.is_web_uri = is_web_iri;
    // Create aliases
    module.exports.isUri = is_iri;
    module.exports.isHttpUri = is_http_iri;
    module.exports.isHttpsUri = is_https_iri;
    module.exports.isWebUri = is_web_iri;


    // private function
    // internal URI spitter method - direct from RFC 3986
    var splitUri = function(uri) {
        var splitted = uri.match(/(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/);
        return splitted;
    };

    function is_iri(value) {
        if (!value) {
            return;
        }

        // check for illegal characters
        if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(value)) return;

        // check for hex escapes that aren't complete
        if (/%[^0-9a-f]/i.test(value)) return;
        if (/%[0-9a-f](:?[^0-9a-f]|$)/i.test(value)) return;

        var splitted = [];
        var scheme = '';
        var authority = '';
        var path = '';
        var query = '';
        var fragment = '';
        var out = '';

        // from RFC 3986
        splitted = splitUri(value);
        scheme = splitted[1]; 
        authority = splitted[2];
        path = splitted[3];
        query = splitted[4];
        fragment = splitted[5];

        // scheme and path are required, though the path can be empty
        if (!(scheme && scheme.length && path.length >= 0)) return;

        // if authority is present, the path must be empty or begin with a /
        if (authority && authority.length) {
            if (!(path.length === 0 || /^\//.test(path))) return;
        } else {
            // if authority is not present, the path must not start with //
            if (/^\/\//.test(path)) return;
        }

        // scheme must begin with a letter, then consist of letters, digits, +, ., or -
        if (!/^[a-z][a-z0-9\+\-\.]*$/.test(scheme.toLowerCase()))  return;

        // re-assemble the URL per section 5.3 in RFC 3986
        out += scheme + ':';
        if (authority && authority.length) {
            out += '//' + authority;
        }

        out += path;

        if (query && query.length) {
            out += '?' + query;
        }

        if (fragment && fragment.length) {
            out += '#' + fragment;
        }

        return out;
    }

    function is_http_iri(value, allowHttps) {
        if (!is_iri(value)) {
            return;
        }

        var splitted = [];
        var scheme = '';
        var authority = '';
        var path = '';
        var port = '';
        var query = '';
        var fragment = '';
        var out = '';

        // from RFC 3986
        splitted = splitUri(value);
        scheme = splitted[1]; 
        authority = splitted[2];
        path = splitted[3];
        query = splitted[4];
        fragment = splitted[5];

        if (!scheme)  return;

        if(allowHttps) {
            if (scheme.toLowerCase() != 'https') return;
        } else {
            if (scheme.toLowerCase() != 'http') return;
        }

        // fully-qualified URIs must have an authority section that is
        // a valid host
        if (!authority) {
            return;
        }

        // enable port component
        if (/:(\d+)$/.test(authority)) {
            port = authority.match(/:(\d+)$/)[0];
            authority = authority.replace(/:\d+$/, '');
        }

        out += scheme + ':';
        out += '//' + authority;
        
        if (port) {
            out += port;
        }
        
        out += path;
        
        if(query && query.length){
            out += '?' + query;
        }

        if(fragment && fragment.length){
            out += '#' + fragment;
        }
        
        return out;
    }

    function is_https_iri(value) {
        return is_http_iri(value, true);
    }

    function is_web_iri(value) {
        return (is_http_iri(value) || is_https_iri(value));
    }

})(module);

}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/../node_modules/valid-url/index.js","/../node_modules/valid-url")
},{"buffer":23,"pBGvAp":27}],37:[function(require,module,exports){
module.exports={
  "name": "clarifai",
  "version": "2.9.0",
  "description": "Official Clarifai Javascript SDK",
  "main": "dist/index.js",
  "repository": "https://github.com/Clarifai/clarifai-javascript",
  "author": "Clarifai Inc.",
  "license": "Apache-2.0",
  "scripts": {
    "jsdoc": "jsdoc src/* -t node_modules/minami -d docs/$npm_package_version && jsdoc src/* -t node_modules/minami -d docs/latest",
    "test": "gulp test",
    "watch": "gulp watch",
    "build": "npm run clean && gulp build && npm run jsdoc",
    "release": "release-it",
    "clean": "gulp cleanbuild"
  },
  "dependencies": {
    "axios": "^0.11.1",
    "form-data": "^0.2.0",
    "promise": "^7.1.1",
    "valid-url": "^1.0.9"
  },
  "devDependencies": {
    "babel-eslint": "^6.1.2",
    "babel-preset-es2015": "^6.14.0",
    "babel-register": "^6.14.0",
    "babelify": "^7.3.0",
    "del": "^2.0.2",
    "envify": "^3.4.0",
    "git-branch": "^0.3.0",
    "gulp": "^3.9.1",
    "gulp-awspublish": "^3.0.1",
    "gulp-babel": "^6.1.2",
    "gulp-browserify": "^0.5.1",
    "gulp-concat": "^2.6.0",
    "gulp-eslint": "^2.0.0",
    "gulp-if": "^2.0.0",
    "gulp-insert": "^0.5.0",
    "gulp-jasmine": "^2.2.1",
    "gulp-notify": "2.2.0",
    "gulp-rename": "^1.2.2",
    "gulp-replace-task": "^0.11.0",
    "gulp-uglify": "^1.4.1",
    "gulp-util": "^3.0.6",
    "jsdoc": "^3.4.1",
    "minami": "^1.1.1",
    "release-it": "^2.9.0",
    "require-dir": "^0.3.0",
    "serve-static": "^1.10.0"
  }
}

},{}],38:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');

var _require = require('./helpers'),
    checkType = _require.checkType;

var Models = require('./Models');
var Inputs = require('./Inputs');
var Concepts = require('./Concepts');
var Workflow = require('./Workflow');
var Workflows = require('./Workflows');
var Solutions = require('./solutions/Solutions');

var _require2 = require('./constants'),
    API = _require2.API,
    ERRORS = _require2.ERRORS,
    getBasePath = _require2.getBasePath;

var TOKEN_PATH = API.TOKEN_PATH;


if (typeof window !== 'undefined' && !('Promise' in window)) {
  window.Promise = require('promise');
}

if (typeof global !== 'undefined' && !('Promise' in global)) {
  global.Promise = require('promise');
}

/**
 * top-level class that allows access to models, inputs and concepts
 * @class
 */

var App = function () {
  function App(arg1, arg2, arg3) {
    _classCallCheck(this, App);

    var optionsObj = arg1;
    if ((typeof arg1 === 'undefined' ? 'undefined' : _typeof(arg1)) !== 'object' || arg1 === null) {
      optionsObj = arg3 || {};
      optionsObj.clientId = arg1;
      optionsObj.clientSecret = arg2;
    }
    this._validate(optionsObj);
    this._init(optionsObj);
  }

  /**
   * Gets a token from the API using client credentials
   * @return {Promise(token, error)} A Promise that is fulfilled with the token string or rejected with an error
   */


  _createClass(App, [{
    key: 'getToken',
    value: function getToken() {
      return this._config.token();
    }

    /**
     * Sets the token to use for the API
     * @param {String}         _token    The token you are setting
     * @return {Boolean}                 true if token has valid fields, false if not
     */

  }, {
    key: 'setToken',
    value: function setToken(_token) {
      var token = _token;
      var now = new Date().getTime();
      if (typeof _token === 'string') {
        token = {
          accessToken: _token,
          expiresIn: 176400
        };
      } else {
        token = {
          accessToken: _token.access_token || _token.accessToken,
          expiresIn: _token.expires_in || _token.expiresIn
        };
      }
      if (token.accessToken && token.expiresIn || token.access_token && token.expires_in) {
        if (!token.expireTime) {
          token.expireTime = now + token.expiresIn * 1000;
        }
        this._config._token = token;
        return true;
      }
      return false;
    }
  }, {
    key: '_validate',
    value: function _validate(_ref) {
      var clientId = _ref.clientId,
          clientSecret = _ref.clientSecret,
          token = _ref.token,
          apiKey = _ref.apiKey,
          sessionToken = _ref.sessionToken;

      if ((!clientId || !clientSecret) && !token && !apiKey && !sessionToken) {
        throw ERRORS.paramsRequired(['Client ID', 'Client Secret']);
      }
    }
  }, {
    key: '_init',
    value: function _init(options) {
      var _this = this;

      var apiEndpoint = options.apiEndpoint || process && process.env && process.env.API_ENDPOINT || 'https://api.clarifai.com';
      this._config = {
        apiEndpoint: apiEndpoint,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        apiKey: options.apiKey,
        sessionToken: options.sessionToken,
        basePath: getBasePath(apiEndpoint, options.userId, options.appId),
        token: function token() {
          return new Promise(function (resolve, reject) {
            var now = new Date().getTime();
            if (checkType(/Object/, _this._config._token) && _this._config._token.expireTime > now) {
              resolve(_this._config._token);
            } else {
              _this._getToken(resolve, reject);
            }
          });
        }
      };
      if (options.token) {
        this.setToken(options.token);
      }
      this.models = new Models(this._config);
      this.inputs = new Inputs(this._config);
      this.concepts = new Concepts(this._config);
      this.workflow = new Workflow(this._config);
      this.workflows = new Workflows(this._config);
      this.solutions = new Solutions(this._config);
    }
  }, {
    key: '_getToken',
    value: function _getToken(resolve, reject) {
      var _this2 = this;

      this._requestToken().then(function (response) {
        if (response.status === 200) {
          _this2.setToken(response.data);
          resolve(_this2._config._token);
        } else {
          reject(response);
        }
      }, reject);
    }
  }, {
    key: '_requestToken',
    value: function _requestToken() {
      var url = '' + this._config.basePath + TOKEN_PATH;
      var clientId = this._config.clientId;
      var clientSecret = this._config.clientSecret;
      return axios({
        'url': url,
        'method': 'POST',
        'auth': {
          'username': clientId,
          'password': clientSecret
        }
      });
    }
  }]);

  return App;
}();

module.exports = App;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJjaGVja1R5cGUiLCJNb2RlbHMiLCJJbnB1dHMiLCJDb25jZXB0cyIsIldvcmtmbG93IiwiV29ya2Zsb3dzIiwiU29sdXRpb25zIiwiQVBJIiwiRVJST1JTIiwiZ2V0QmFzZVBhdGgiLCJUT0tFTl9QQVRIIiwid2luZG93IiwiUHJvbWlzZSIsImdsb2JhbCIsIkFwcCIsImFyZzEiLCJhcmcyIiwiYXJnMyIsIm9wdGlvbnNPYmoiLCJjbGllbnRJZCIsImNsaWVudFNlY3JldCIsIl92YWxpZGF0ZSIsIl9pbml0IiwiX2NvbmZpZyIsInRva2VuIiwiX3Rva2VuIiwibm93IiwiRGF0ZSIsImdldFRpbWUiLCJhY2Nlc3NUb2tlbiIsImV4cGlyZXNJbiIsImFjY2Vzc190b2tlbiIsImV4cGlyZXNfaW4iLCJleHBpcmVUaW1lIiwiYXBpS2V5Iiwic2Vzc2lvblRva2VuIiwicGFyYW1zUmVxdWlyZWQiLCJvcHRpb25zIiwiYXBpRW5kcG9pbnQiLCJwcm9jZXNzIiwiZW52IiwiQVBJX0VORFBPSU5UIiwiYmFzZVBhdGgiLCJ1c2VySWQiLCJhcHBJZCIsInJlc29sdmUiLCJyZWplY3QiLCJfZ2V0VG9rZW4iLCJzZXRUb2tlbiIsIm1vZGVscyIsImlucHV0cyIsImNvbmNlcHRzIiwid29ya2Zsb3ciLCJ3b3JrZmxvd3MiLCJzb2x1dGlvbnMiLCJfcmVxdWVzdFRva2VuIiwidGhlbiIsInJlc3BvbnNlIiwic3RhdHVzIiwiZGF0YSIsInVybCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsSUFBSUEsUUFBUUMsUUFBUSxPQUFSLENBQVo7O2VBQ2tCQSxRQUFRLFdBQVIsQztJQUFiQyxTLFlBQUFBLFM7O0FBQ0wsSUFBSUMsU0FBU0YsUUFBUSxVQUFSLENBQWI7QUFDQSxJQUFJRyxTQUFTSCxRQUFRLFVBQVIsQ0FBYjtBQUNBLElBQUlJLFdBQVdKLFFBQVEsWUFBUixDQUFm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LFNBQUwsR0FBaUIsSUFBSWhELFNBQUosQ0FBYyxLQUFLa0IsT0FBbkIsQ0FBakI7QUFDQSxXQUFLK0IsU0FBTCxHQUFpQixJQUFJaEQsU0FBSixDQUFjLEtBQUtpQixPQUFuQixDQUFqQjtBQUNEOzs7OEJBRVNzQixPLEVBQVNDLE0sRUFBUTtBQUFBOztBQUN6QixXQUFLUyxhQUFMLEdBQXFCQyxJQUFyQixDQUNFLFVBQUNDLFFBQUQsRUFBYztBQUNaLFlBQUlBLFNBQVNDLE1BQVQsS0FBb0IsR0FBeEIsRUFBNkI7QUFDM0IsaUJBQUtWLFFBQUwsQ0FBY1MsU0FBU0UsSUFBdkI7QUFDQWQsa0JBQVEsT0FBS3RCLE9BQUwsQ0FBYUUsTUFBckI7QUFDRCxTQUhELE1BR087QUFDTHFCLGlCQUFPVyxRQUFQO0FBQ0Q7QUFDRixPQVJILEVBU0VYLE1BVEY7QUFXRDs7O29DQUVlO0FBQ2QsVUFBSWMsV0FBUyxLQUFLckMsT0FBTCxDQUFhbUIsUUFBdEIsR0FBaUNoQyxVQUFyQztBQUNBLFVBQUlTLFdBQVcsS0FBS0ksT0FBTCxDQUFhSixRQUE1QjtBQUNBLFVBQUlDLGVBQWUsS0FBS0csT0FBTCxDQUFhSCxZQUFoQztBQUNBLGFBQU90QixNQUFNO0FBQ1gsZUFBTzhELEdBREk7QUFFWCxrQkFBVSxNQUZDO0FBR1gsZ0JBQVE7QUFDTixzQkFBWXpDLFFBRE47QUFFTixzQkFBWUM7QUFGTjtBQUhHLE9BQU4sQ0FBUDtBQVFEOzs7Ozs7QUFHSHlDLE9BQU9DLE9BQVAsR0FBaUJoRCxHQUFqQiIsImZpbGUiOiJBcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IHtjaGVja1R5cGV9ID0gcmVxdWlyZSgnLi9oZWxwZXJzJyk7XG5sZXQgTW9kZWxzID0gcmVxdWlyZSgnLi9Nb2RlbHMnKTtcbmxldCBJbnB1dHMgPSByZXF1aXJlKCcuL0lucHV0cycpO1xubGV0IENvbmNlcHRzID0gcmVxdWlyZSgnLi9Db25jZXB0cycpO1xubGV0IFdvcmtmbG93ID0gcmVxdWlyZSgnLi9Xb3JrZmxvdycpO1xubGV0IFdvcmtmbG93cyA9IHJlcXVpcmUoJy4vV29ya2Zsb3dzJyk7XG5sZXQgU29sdXRpb25zID0gcmVxdWlyZSgnLi9zb2x1dGlvbnMvU29sdXRpb25zJyk7XG5sZXQge0FQSSwgRVJST1JTLCBnZXRCYXNlUGF0aH0gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtUT0tFTl9QQVRIfSA9IEFQSTtcblxuaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmICEoJ1Byb21pc2UnIGluIHdpbmRvdykpIHtcbiAgd2luZG93LlByb21pc2UgPSByZXF1aXJlKCdwcm9taXNlJyk7XG59XG5cbmlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyAmJiAhKCdQcm9taXNlJyBpbiBnbG9iYWwpKSB7XG4gIGdsb2JhbC5Qcm9taXNlID0gcmVxdWlyZSgncHJvbWlzZScpO1xufVxuXG4vKipcbiAqIHRvcC1sZXZlbCBjbGFzcyB0aGF0IGFsbG93cyBhY2Nlc3MgdG8gbW9kZWxzLCBpbnB1dHMgYW5kIGNvbmNlcHRzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgQXBwIHtcbiAgY29uc3RydWN0b3IoYXJnMSwgYXJnMiwgYXJnMykge1xuICAgIGxldCBvcHRpb25zT2JqID0gYXJnMTtcbiAgICBpZiAodHlwZW9mIGFyZzEgIT09ICdvYmplY3QnIHx8IGFyZzEgPT09IG51bGwpIHtcbiAgICAgIG9wdGlvbnNPYmogPSBhcmczIHx8IHt9O1xuICAgICAgb3B0aW9uc09iai5jbGllbnRJZCA9IGFyZzE7XG4gICAgICBvcHRpb25zT2JqLmNsaWVudFNlY3JldCA9IGFyZzI7XG4gICAgfVxuICAgIHRoaXMuX3ZhbGlkYXRlKG9wdGlvbnNPYmopO1xuICAgIHRoaXMuX2luaXQob3B0aW9uc09iaik7XG5cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGEgdG9rZW4gZnJvbSB0aGUgQVBJIHVzaW5nIGNsaWVudCBjcmVkZW50aWFsc1xuICAgKiBAcmV0dXJuIHtQcm9taXNlKHRva2VuLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSB0b2tlbiBzdHJpbmcgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0VG9rZW4oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbmZpZy50b2tlbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHRva2VuIHRvIHVzZSBmb3IgdGhlIEFQSVxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICBfdG9rZW4gICAgVGhlIHRva2VuIHlvdSBhcmUgc2V0dGluZ1xuICAgKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICAgICAgICAgdHJ1ZSBpZiB0b2tlbiBoYXMgdmFsaWQgZmllbGRzLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIHNldFRva2VuKF90b2tlbikge1xuICAgIGxldCB0b2tlbiA9IF90b2tlbjtcbiAgICBsZXQgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgaWYgKHR5cGVvZiBfdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICB0b2tlbiA9IHtcbiAgICAgICAgYWNjZXNzVG9rZW46IF90b2tlbixcbiAgICAgICAgZXhwaXJlc0luOiAxNzY0MDBcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRva2VuID0ge1xuICAgICAgICBhY2Nlc3NUb2tlbjogX3Rva2VuLmFjY2Vzc190b2tlbiB8fCBfdG9rZW4uYWNjZXNzVG9rZW4sXG4gICAgICAgIGV4cGlyZXNJbjogX3Rva2VuLmV4cGlyZXNfaW4gfHwgX3Rva2VuLmV4cGlyZXNJblxuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKCh0b2tlbi5hY2Nlc3NUb2tlbiAmJiB0b2tlbi5leHBpcmVzSW4pIHx8XG4gICAgICAodG9rZW4uYWNjZXNzX3Rva2VuICYmIHRva2VuLmV4cGlyZXNfaW4pKSB7XG4gICAgICBpZiAoIXRva2VuLmV4cGlyZVRpbWUpIHtcbiAgICAgICAgdG9rZW4uZXhwaXJlVGltZSA9IG5vdyArICh0b2tlbi5leHBpcmVzSW4gKiAxMDAwKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NvbmZpZy5fdG9rZW4gPSB0b2tlbjtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfdmFsaWRhdGUoe2NsaWVudElkLCBjbGllbnRTZWNyZXQsIHRva2VuLCBhcGlLZXksIHNlc3Npb25Ub2tlbn0pIHtcbiAgICBpZiAoKCFjbGllbnRJZCB8fCAhY2xpZW50U2VjcmV0KSAmJiAhdG9rZW4gJiYgIWFwaUtleSAmJiAhc2Vzc2lvblRva2VuKSB7XG4gICAgICB0aHJvdyBFUlJPUlMucGFyYW1zUmVxdWlyZWQoWydDbGllbnQgSUQnLCAnQ2xpZW50IFNlY3JldCddKTtcbiAgICB9XG4gIH1cblxuICBfaW5pdChvcHRpb25zKSB7XG4gICAgbGV0IGFwaUVuZHBvaW50ID0gb3B0aW9ucy5hcGlFbmRwb2ludCB8fFxuICAgICAgKHByb2Nlc3MgJiYgcHJvY2Vzcy5lbnYgJiYgcHJvY2Vzcy5lbnYuQVBJX0VORFBPSU5UKSB8fCAnaHR0cHM6Ly9hcGkuY2xhcmlmYWkuY29tJztcbiAgICB0aGlzLl9jb25maWcgPSB7XG4gICAgICBhcGlFbmRwb2ludCxcbiAgICAgIGNsaWVudElkOiBvcHRpb25zLmNsaWVudElkLFxuICAgICAgY2xpZW50U2VjcmV0OiBvcHRpb25zLmNsaWVudFNlY3JldCxcbiAgICAgIGFwaUtleTogb3B0aW9ucy5hcGlLZXksXG4gICAgICBzZXNzaW9uVG9rZW46IG9wdGlvbnMuc2Vzc2lvblRva2VuLFxuICAgICAgYmFzZVBhdGg6IGdldEJhc2VQYXRoKGFwaUVuZHBvaW50LCBvcHRpb25zLnVzZXJJZCwgb3B0aW9ucy5hcHBJZCksXG4gICAgICB0b2tlbjogKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGxldCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICBpZiAoY2hlY2tUeXBlKC9PYmplY3QvLCB0aGlzLl9jb25maWcuX3Rva2VuKSAmJiB0aGlzLl9jb25maWcuX3Rva2VuLmV4cGlyZVRpbWUgPiBub3cpIHtcbiAgICAgICAgICAgIHJlc29sdmUodGhpcy5fY29uZmlnLl90b2tlbik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2dldFRva2VuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChvcHRpb25zLnRva2VuKSB7XG4gICAgICB0aGlzLnNldFRva2VuKG9wdGlvbnMudG9rZW4pO1xuICAgIH1cbiAgICB0aGlzLm1vZGVscyA9IG5ldyBNb2RlbHModGhpcy5fY29uZmlnKTtcbiAgICB0aGlzLmlucHV0cyA9IG5ldyBJbnB1dHModGhpcy5fY29uZmlnKTtcbiAgICB0aGlzLmNvbmNlcHRzID0gbmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZyk7XG4gICAgdGhpcy53b3JrZmxvdyA9IG5ldyBXb3JrZmxvdyh0aGlzLl9jb25maWcpO1xuICAgIHRoaXMud29ya2Zsb3dzID0gbmV3IFdvcmtmbG93cyh0aGlzLl9jb25maWcpO1xuICAgIHRoaXMuc29sdXRpb25zID0gbmV3IFNvbHV0aW9ucyh0aGlzLl9jb25maWcpO1xuICB9XG5cbiAgX2dldFRva2VuKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMuX3JlcXVlc3RUb2tlbigpLnRoZW4oXG4gICAgICAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgdGhpcy5zZXRUb2tlbihyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKHRoaXMuX2NvbmZpZy5fdG9rZW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICByZWplY3RcbiAgICApO1xuICB9XG5cbiAgX3JlcXVlc3RUb2tlbigpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7VE9LRU5fUEFUSH1gO1xuICAgIGxldCBjbGllbnRJZCA9IHRoaXMuX2NvbmZpZy5jbGllbnRJZDtcbiAgICBsZXQgY2xpZW50U2VjcmV0ID0gdGhpcy5fY29uZmlnLmNsaWVudFNlY3JldDtcbiAgICByZXR1cm4gYXhpb3Moe1xuICAgICAgJ3VybCc6IHVybCxcbiAgICAgICdtZXRob2QnOiAnUE9TVCcsXG4gICAgICAnYXV0aCc6IHtcbiAgICAgICAgJ3VzZXJuYW1lJzogY2xpZW50SWQsXG4gICAgICAgICdwYXNzd29yZCc6IGNsaWVudFNlY3JldFxuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQXBwO1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/App.js","/")
},{"./Concepts":40,"./Inputs":42,"./Models":45,"./Workflow":48,"./Workflows":49,"./constants":50,"./helpers":52,"./solutions/Solutions":54,"axios":4,"buffer":23,"pBGvAp":27,"promise":28}],39:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * class representing a concept and its info
 * @class
 */
var Concept = function Concept(_config, data) {
  _classCallCheck(this, Concept);

  this.id = data.id;
  this.name = data.name;
  this.createdAt = data.created_at || data.createdAt;
  this.appId = data.app_id || data.appId;
  this.value = data.value || null;
  this._config = _config;
  this.rawData = data;
};

;

module.exports = Concept;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNvbmNlcHQuanMiXSwibmFtZXMiOlsiQ29uY2VwdCIsIl9jb25maWciLCJkYXRhIiwiaWQiLCJuYW1lIiwiY3JlYXRlZEF0IiwiY3JlYXRlZF9hdCIsImFwcElkIiwiYXBwX2lkIiwidmFsdWUiLCJyYXdEYXRhIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7O0lBSU1BLE8sR0FDSixpQkFBWUMsT0FBWixFQUFxQkMsSUFBckIsRUFBMkI7QUFBQTs7QUFDekIsT0FBS0MsRUFBTCxHQUFVRCxLQUFLQyxFQUFmO0FBQ0EsT0FBS0MsSUFBTCxHQUFZRixLQUFLRSxJQUFqQjtBQUNBLE9BQUtDLFNBQUwsR0FBaUJILEtBQUtJLFVBQUwsSUFBbUJKLEtBQUtHLFNBQXpDO0FBQ0EsT0FBS0UsS0FBTCxHQUFhTCxLQUFLTSxNQUFMLElBQWVOLEtBQUtLLEtBQWpDO0FBQ0EsT0FBS0UsS0FBTCxHQUFhUCxLQUFLTyxLQUFMLElBQWMsSUFBM0I7QUFDQSxPQUFLUixPQUFMLEdBQWVBLE9BQWY7QUFDQSxPQUFLUyxPQUFMLEdBQWVSLElBQWY7QUFDRCxDOztBQUVIOztBQUVBUyxPQUFPQyxPQUFQLEdBQWlCWixPQUFqQiIsImZpbGUiOiJDb25jZXB0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb25jZXB0IGFuZCBpdHMgaW5mb1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIENvbmNlcHQge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xuICAgIHRoaXMuY3JlYXRlZEF0ID0gZGF0YS5jcmVhdGVkX2F0IHx8IGRhdGEuY3JlYXRlZEF0O1xuICAgIHRoaXMuYXBwSWQgPSBkYXRhLmFwcF9pZCB8fCBkYXRhLmFwcElkO1xuICAgIHRoaXMudmFsdWUgPSBkYXRhLnZhbHVlIHx8IG51bGw7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uY2VwdDtcbiJdfQ==
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Concept.js","/")
},{"buffer":23,"pBGvAp":27}],40:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var Concept = require('./Concept');

var _require = require('./constants'),
    API = _require.API,
    replaceVars = _require.replaceVars;

var CONCEPTS_PATH = API.CONCEPTS_PATH,
    CONCEPT_PATH = API.CONCEPT_PATH,
    CONCEPT_SEARCH_PATH = API.CONCEPT_SEARCH_PATH;

var _require2 = require('./utils'),
    wrapToken = _require2.wrapToken,
    formatConcept = _require2.formatConcept;

var _require3 = require('./helpers'),
    isSuccess = _require3.isSuccess,
    checkType = _require3.checkType;

/**
 * class representing a collection of concepts
 * @class
 */


var Concepts = function () {
  function Concepts(_config) {
    var _this = this;

    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Concepts);

    this._config = _config;
    this.rawData = rawData;
    rawData.forEach(function (conceptData, index) {
      _this[index] = new Concept(_this._config, conceptData);
    });
    this.length = rawData.length;
  }

  /**
   * List all the concepts
   * @param {object}     options     Object with keys explained below: (optional)
   *    @param {number}    options.page        The page number (optional, default: 1)
   *    @param {number}    options.perPage     Number of images to return per page (optional, default: 20)
   * @return {Promise(Concepts, error)} A Promise that is fulfilled with a Concepts instance or rejected with an error
   */


  _createClass(Concepts, [{
    key: 'list',
    value: function list() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + CONCEPTS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, {
            headers: headers,
            params: {
              'page': options.page,
              'per_page': options.perPage
            }
          }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Concepts(_this2._config, response.data.concepts));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * List a single concept given an id
     * @param {String}     id          The concept's id
     * @return {Promise(Concept, error)} A Promise that is fulfilled with a Concept instance or rejected with an error
     */

  }, {
    key: 'get',
    value: function get(id) {
      var _this3 = this;

      var url = '' + this._config.basePath + replaceVars(CONCEPT_PATH, [id]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Concept(_this3._config, response.data.concept));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Add a list of concepts given an id and name
     * @param {object|object[]}   concepts       Can be a single media object or an array of media objects
     *   @param  {object|string}    concepts[].concept         If string, this is assumed to be the concept id. Otherwise, an object with the following attributes
     *     @param  {object}           concepts[].concept.id      The new concept's id (Required)
     *     @param  {object}           concepts[].concept.name    The new concept's name
     * @return {Promise(Concepts, error)}             A Promise that is fulfilled with a Concepts instance or rejected with an error
     */

  }, {
    key: 'create',
    value: function create() {
      var _this4 = this;

      var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      if (checkType(/(Object|String)/, concepts)) {
        concepts = [concepts];
      }
      var data = {
        'concepts': concepts.map(formatConcept)
      };
      var url = '' + this._config.basePath + CONCEPTS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Concepts(_this4._config, response.data.concepts));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Search for a concept given a name. A wildcard can be given (example: The name "bo*" will match with "boat" and "bow" given those concepts exist
     * @param  {string}   name  The name of the concept to search for
     * @return {Promise(Concepts, error)} A Promise that is fulfilled with a Concepts instance or rejected with an error
     */

  }, {
    key: 'search',
    value: function search(name) {
      var _this5 = this;

      var language = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      var url = '' + this._config.basePath + CONCEPT_SEARCH_PATH;
      return wrapToken(this._config, function (headers) {
        var params = {
          'concept_query': { name: name, language: language }
        };
        return new Promise(function (resolve, reject) {
          axios.post(url, params, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Concepts(_this5._config, response.data.concepts));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Update a concepts
     * @param {object|object[]}   concepts       Can be a single concept object or an array of concept objects
     *   @param  {object}           concepts[].concept         A concept object with the following attributes
     *     @param  {object}           concepts[].concept.id      The concept's id (Required)
     *     @param  {object}           concepts[].concept.name    The concept's new name
     * @param {string}            [action=overwrite]  The action to use for the PATCH
     * @return {Promise(Concepts, error)}             A Promise that is fulfilled with a Concepts instance or rejected with an error
     */

  }, {
    key: 'update',
    value: function update() {
      var _this6 = this;

      var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'overwrite';

      if (!checkType(/Array/, concepts)) {
        concepts = [concepts];
      }
      var data = {
        concepts: concepts,
        action: action
      };
      var url = '' + this._config.basePath + CONCEPTS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.patch(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Concepts(_this6._config, response.data.concepts));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }]);

  return Concepts;
}();

;

module.exports = Concepts;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNvbmNlcHRzLmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkNvbmNlcHQiLCJBUEkiLCJyZXBsYWNlVmFycyIsIkNPTkNFUFRTX1BBVEgiLCJDT05DRVBUX1BBVEgiLCJDT05DRVBUX1NFQVJDSF9QQVRIIiwid3JhcFRva2VuIiwiZm9ybWF0Q29uY2VwdCIsImlzU3VjY2VzcyIsImNoZWNrVHlwZSIsIkNvbmNlcHRzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwiY29uY2VwdERhdGEiLCJpbmRleCIsImxlbmd0aCIsIm9wdGlvbnMiLCJwYWdlIiwicGVyUGFnZSIsInVybCIsImJhc2VQYXRoIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0IiwicGFyYW1zIiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsImNvbmNlcHRzIiwiaWQiLCJjb25jZXB0IiwibWFwIiwicG9zdCIsIm5hbWUiLCJsYW5ndWFnZSIsImFjdGlvbiIsInBhdGNoIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBSUEsUUFBUUMsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFJQyxVQUFVRCxRQUFRLFdBQVIsQ0FBZDs7ZUFDeUJBLFFBQVEsYUFBUixDO0lBQXBCRSxHLFlBQUFBLEc7SUFBS0MsVyxZQUFBQSxXOztJQUNMQyxhLEdBQW9ERixHLENBQXBERSxhO0lBQWVDLFksR0FBcUNILEcsQ0FBckNHLFk7SUFBY0MsbUIsR0FBdUJKLEcsQ0FBdkJJLG1COztnQkFDRE4sUUFBUSxTQUFSLEM7SUFBNUJPLFMsYUFBQUEsUztJQUFXQyxhLGFBQUFBLGE7O2dCQUNhUixRQUFRLFdBQVIsQztJQUF4QlMsUyxhQUFBQSxTO0lBQVdDLFMsYUFBQUEsUzs7QUFFaEI7Ozs7OztJQUlNQyxRO0FBQ0osb0JBQVlDLE9BQVosRUFBbUM7QUFBQTs7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pD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YixXQUFhOztBQUMxQyxVQUFJLENBQUM3QixVQUFVLE9BQVYsRUFBbUJzQixRQUFuQixDQUFMLEVBQW1DO0FBQ2pDQSxtQkFBVyxDQUFDQSxRQUFELENBQVg7QUFDRDtBQUNELFVBQU1ELE9BQU87QUFDWEMsMEJBRFc7QUFFWE87QUFGVyxPQUFiO0FBSUEsVUFBTWxCLFdBQVMsS0FBS1QsT0FBTCxDQUFhVSxRQUF0QixHQUFpQ2xCLGFBQXZDO0FBQ0EsYUFBT0csVUFBVSxLQUFLSyxPQUFmLEVBQXdCLG1CQUFXO0FBQ3hDLGVBQU8sSUFBSVksT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0QzNCLGdCQUFNeUMsS0FBTixDQUFZbkIsR0FBWixFQUFpQlUsSUFBakIsRUFBdUIsRUFBRVIsZ0JBQUYsRUFBdkIsRUFDR00sSUFESCxDQUNRLFVBQUNDLFFBQUQsRUFBYztBQUNsQixnQkFBSXJCLFVBQVVxQixRQUFWLENBQUosRUFBeUI7QUFDdkJMLHNCQUFRLElBQUlkLFFBQUosQ0FBYSxPQUFLQyxPQUFsQixFQUEyQmtCLFNBQVNDLElBQVQsQ0FBY0MsUUFBekMsQ0FBUjtBQUNELGFBRkQsTUFFTztBQUNMTixxQkFBT0ksUUFBUDtBQUNEO0FBQ0YsV0FQSCxFQU9LSixNQVBMO0FBUUQsU0FUTSxDQUFQO0FBVUQsT0FYTSxDQUFQO0FBWUQ7Ozs7OztBQUNGOztBQUVEZSxPQUFPQyxPQUFQLEdBQWlCL0IsUUFBakIiLCJmaWxlIjoiQ29uY2VwdHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IENvbmNlcHQgPSByZXF1aXJlKCcuL0NvbmNlcHQnKTtcbmxldCB7QVBJLCByZXBsYWNlVmFyc30gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtDT05DRVBUU19QQVRILCBDT05DRVBUX1BBVEgsIENPTkNFUFRfU0VBUkNIX1BBVEh9ID0gQVBJO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdENvbmNlcHR9ID0gcmVxdWlyZSgnLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsIGNoZWNrVHlwZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb2xsZWN0aW9uIG9mIGNvbmNlcHRzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgQ29uY2VwdHMge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCByYXdEYXRhID0gW10pIHtcbiAgICB0aGlzLl9jb25maWcgPSBfY29uZmlnO1xuICAgIHRoaXMucmF3RGF0YSA9IHJhd0RhdGE7XG4gICAgcmF3RGF0YS5mb3JFYWNoKChjb25jZXB0RGF0YSwgaW5kZXgpID0+IHtcbiAgICAgIHRoaXNbaW5kZXhdID0gbmV3IENvbmNlcHQodGhpcy5fY29uZmlnLCBjb25jZXB0RGF0YSk7XG4gICAgfSk7XG4gICAgdGhpcy5sZW5ndGggPSByYXdEYXRhLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0IGFsbCB0aGUgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgICBAcGFyYW0ge251bWJlcn0gICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgICBAcGFyYW0ge251bWJlcn0gICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbGlzdChvcHRpb25zID0ge3BhZ2U6IDEsIHBlclBhZ2U6IDIwfSkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7XG4gICAgICAgICAgaGVhZGVycyxcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICdwYWdlJzogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgJ3Blcl9wYWdlJzogb3B0aW9ucy5wZXJQYWdlLFxuICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgQ29uY2VwdHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHRzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGlzdCBhIHNpbmdsZSBjb25jZXB0IGdpdmVuIGFuIGlkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgaWQgICAgICAgICAgVGhlIGNvbmNlcHQncyBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHQsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBDb25jZXB0IGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhDT05DRVBUX1BBVEgsIFtpZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHQodGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHQpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0IG9mIGNvbmNlcHRzIGdpdmVuIGFuIGlkIGFuZCBuYW1lXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgIGNvbmNlcHRzICAgICAgIENhbiBiZSBhIHNpbmdsZSBtZWRpYSBvYmplY3Qgb3IgYW4gYXJyYXkgb2YgbWVkaWEgb2JqZWN0c1xuICAgKiAgIEBwYXJhbSAge29iamVjdHxzdHJpbmd9ICAgIGNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgIElmIHN0cmluZywgdGhpcyBpcyBhc3N1bWVkIHRvIGJlIHRoZSBjb25jZXB0IGlkLiBPdGhlcndpc2UsIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlc1xuICAgKiAgICAgQHBhcmFtICB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgVGhlIG5ldyBjb25jZXB0J3MgaWQgKFJlcXVpcmVkKVxuICAgKiAgICAgQHBhcmFtICB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0Lm5hbWUgICAgVGhlIG5ldyBjb25jZXB0J3MgbmFtZVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9ICAgICAgICAgICAgIEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgY3JlYXRlKGNvbmNlcHRzID0gW10pIHtcbiAgICBpZiAoY2hlY2tUeXBlKC8oT2JqZWN0fFN0cmluZykvLCBjb25jZXB0cykpIHtcbiAgICAgIGNvbmNlcHRzID0gW2NvbmNlcHRzXTtcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICAnY29uY2VwdHMnOiBjb25jZXB0cy5tYXAoZm9ybWF0Q29uY2VwdClcbiAgICB9O1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgZGF0YSwge2hlYWRlcnN9KVxuICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShuZXcgQ29uY2VwdHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbmNlcHRzKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggZm9yIGEgY29uY2VwdCBnaXZlbiBhIG5hbWUuIEEgd2lsZGNhcmQgY2FuIGJlIGdpdmVuIChleGFtcGxlOiBUaGUgbmFtZSBcImJvKlwiIHdpbGwgbWF0Y2ggd2l0aCBcImJvYXRcIiBhbmQgXCJib3dcIiBnaXZlbiB0aG9zZSBjb25jZXB0cyBleGlzdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICAgbmFtZSAgVGhlIG5hbWUgb2YgdGhlIGNvbmNlcHQgdG8gc2VhcmNoIGZvclxuICAgKiBAcmV0dXJuIHtQcm9taXNlKENvbmNlcHRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgQ29uY2VwdHMgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgc2VhcmNoKG5hbWUsIGxhbmd1YWdlID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUX1NFQVJDSF9QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICBsZXQgcGFyYW1zID0ge1xuICAgICAgICAnY29uY2VwdF9xdWVyeSc6IHtuYW1lLCBsYW5ndWFnZX1cbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgcGFyYW1zLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5jb25jZXB0cykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgIGNvbmNlcHRzICAgICAgIENhbiBiZSBhIHNpbmdsZSBjb25jZXB0IG9iamVjdCBvciBhbiBhcnJheSBvZiBjb25jZXB0IG9iamVjdHNcbiAgICogICBAcGFyYW0gIHtvYmplY3R9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQgICAgICAgICBBIGNvbmNlcHQgb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBhdHRyaWJ1dGVzXG4gICAqICAgICBAcGFyYW0gIHtvYmplY3R9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICBUaGUgY29uY2VwdCdzIGlkIChSZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSAge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC5uYW1lICAgIFRoZSBjb25jZXB0J3MgbmV3IG5hbWVcbiAgICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgW2FjdGlvbj1vdmVyd3JpdGVdICBUaGUgYWN0aW9uIHRvIHVzZSBmb3IgdGhlIFBBVENIXG4gICAqIEByZXR1cm4ge1Byb21pc2UoQ29uY2VwdHMsIGVycm9yKX0gICAgICAgICAgICAgQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBDb25jZXB0cyBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB1cGRhdGUoY29uY2VwdHMgPSBbXSwgYWN0aW9uID0gJ292ZXJ3cml0ZScpIHtcbiAgICBpZiAoIWNoZWNrVHlwZSgvQXJyYXkvLCBjb25jZXB0cykpIHtcbiAgICAgIGNvbmNlcHRzID0gW2NvbmNlcHRzXTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIGNvbmNlcHRzLFxuICAgICAgYWN0aW9uXG4gICAgfTtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtDT05DRVBUU19QQVRIfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIGhlYWRlcnMgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7IGhlYWRlcnMgfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUobmV3IENvbmNlcHRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5jb25jZXB0cykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29uY2VwdHM7XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Concepts.js","/")
},{"./Concept":39,"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27}],41:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var Concepts = require('./Concepts');
var Regions = require('./Regions');

var _require = require('./constants'),
    API = _require.API;

var INPUTS_PATH = API.INPUTS_PATH;

/**
 * class representing an input
 * @class
 */

var Input = function () {
  function Input(_config, data) {
    _classCallCheck(this, Input);

    this.id = data.id;
    this.createdAt = data.created_at || data.createdAt;
    this.imageUrl = data.data.image.url;
    this.concepts = new Concepts(_config, data.data.concepts);
    this.regions = new Regions(_config, data.data.regions || []);
    this.score = data.score;
    this.metadata = data.data.metadata;
    if (data.data.geo && data.data.geo['geo_point']) {
      this.geo = { geoPoint: data.data.geo['geo_point'] };
    }
    this.rawData = data;
    this._config = _config;
  }

  /**
   * Merge concepts to an input
   * @param {object[]}         concepts    Object with keys explained below:
   *   @param {object}           concepts[].concept
   *     @param {string}           concepts[].concept.id        The concept id (required)
   *     @param {boolean}          concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
   * @param {object}           metadata                      Object with key values to attach to the input (optional)
   * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
   */


  _createClass(Input, [{
    key: 'mergeConcepts',
    value: function mergeConcepts(concepts, metadata) {
      return this._update('merge', concepts, metadata);
    }

    /**
     * Delete concept from an input
     * @param {object[]}         concepts    Object with keys explained below:
     *   @param {object}           concepts[].concept
     *     @param {string}           concepts[].concept.id        The concept id (required)
     *     @param {boolean}          concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @param {object}           metadata                      Object with key values to attach to the input (optional)
     * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
     */

  }, {
    key: 'deleteConcepts',
    value: function deleteConcepts(concepts, metadata) {
      return this._update('remove', concepts, metadata);
    }

    /**
     * Overwrite inputs
     * @param {object[]}         concepts                      Array of object with keys explained below:
     *   @param {object}           concepts[].concept
     *     @param {string}           concepts[].concept.id         The concept id (required)
     *     @param {boolean}          concepts[].concept.value      Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @param {object}           metadata                      Object with key values to attach to the input (optional)
     * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
     */

  }, {
    key: 'overwriteConcepts',
    value: function overwriteConcepts(concepts, metadata) {
      return this._update('overwrite', concepts, metadata);
    }
  }, {
    key: '_update',
    value: function _update(action) {
      var concepts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      var metadata = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

      var url = '' + this._config.basePath + INPUTS_PATH;
      var inputData = {};
      if (concepts.length) {
        inputData.concepts = concepts;
      }
      if (metadata !== null) {
        inputData.metadata = metadata;
      }
      var data = {
        action: action,
        inputs: [{
          id: this.id,
          data: inputData
        }]
      };
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          return axios.patch(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Input(response.data.input));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }]);

  return Input;
}();

;

module.exports = Input;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIklucHV0LmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkNvbmNlcHRzIiwiUmVnaW9ucyIsIkFQSSIsIklOUFVUU19QQVRIIiwiSW5wdXQiLCJfY29uZmlnIiwiZGF0YSIsImlkIiwiY3JlYXRlZEF0IiwiY3JlYXRlZF9hdCIsImltYWdlVXJsIiwiaW1hZ2UiLCJ1cmwiLCJjb25jZXB0cyIsInJlZ2lvbnMiLCJzY29yZSIsIm1ldGFkYXRhIiwiZ2VvIiwiZ2VvUG9pbnQiLCJyYXdEYXRhIiwiX3VwZGF0ZSIsImFjdGlvbiIsImJhc2VQYXRoIiwiaW5wdXREYXRhIiwibGVuZ3RoIiwiaW5wdXRzIiwid3JhcFRva2VuIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicGF0Y2giLCJ0aGVuIiwicmVzcG9uc2UiLCJpc1N1Y2Nlc3MiLCJpbnB1dCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQUlBLFFBQVFDLFFBQVEsT0FBUixDQUFaO0FBQ0EsSUFBSUMsV0FBV0QsUUFBUSxZQUFSLENBQWY7QUFDQSxJQUFJRSxVQUFVRixRQUFRLFdBQVIsQ0FBZDs7ZUFDWUEsUUFBUSxhQUFSLEM7SUFBUEcsRyxZQUFBQSxHOztJQUNBQyxXLEdBQWVELEcsQ0FBZkMsVzs7QUFFTDs7Ozs7SUFJTUMsSztBQUNKLGlCQUFZQyxPQUFaLEVBQXFCQyxJQUFyQixFQUEyQjtBQUFBOztBQUN6QixTQUFLQyxFQUFMLEdBQVVELEtBQUtDLEVBQWY7QUFDQSxTQUFLQyxTQUFMLEdBQWlCRixLQUFLRyxVQUFMLElBQW1CSCxLQUFLRSxTQUF6QztBQUNBLFNBQUtFLFFBQUwsR0FBZ0JKLEtBQUtBLElBQUwsQ0FBVUssS0FBVixDQUFnQkMsR0FBaEM7QUFDQSxTQUFLQyxRQUFMLEdBQWdCLElBQUliLFFBQUosQ0FBYUssT0FBYixFQUFzQkMsS0FBS0EsSUFBTCxDQUFVTyxRQUFoQyxDQUFoQjtBQUNBLFNBQUtDLE9BQUwsR0FBZSxJQUFJYixPQUFKLENBQVlJLE9BQVosRUFBcUJDLEtBQUtBLElBQUwsQ0FBVVEsT0FBVixJQUFxQixFQUExQyxDQUFmO0FBQ0EsU0FBS0MsS0FBTCxHQUFhVCxLQUFLUyxLQUFsQjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JWLEtBQUtBLElBQUwsQ0FBVVUsUUFBMUI7QUFDQSxRQUFJVixLQUFLQSxJQUFMLENBQVVXLEdBQVYsSUFBaUJYLEtBQUtBLElBQUwsQ0FBVVcsR0FBVixDQUFjLFdBQWQsQ0FBckIsRUFBaUQ7QUFDL0MsV0FBS0EsR0FBTCxHQUFXLEVBQUNDLFVBQVVaLEtBQUtBLElBQUwsQ0FBVVcsR0FBVixDQUFjLFdBQWQsQ0FBWCxFQUFYO0FBQ0Q7QUFDRCxTQUFLRSxPQUFMLEdBQWViLElBQWY7QUFDQSxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7OztrQ0FTY1EsUSxFQUFVRyxRLEVBQVU7QUFDaEMsYUFBTyxLQUFLSSxPQUFMLENBQWEsT0FBYixFQUFzQlAsUUFBdEIsRUFBZ0NHLFFBQWhDLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O21DQVNlSCxRLEVBQVVHLFEsRUFBVTtBQUNqQyxhQUFPLEtBQUtJLE9BQUwsQ0FBYSxRQUFiLEVBQXVCUCxRQUF2QixFQUFpQ0csUUFBakMsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7c0NBU2tCSCxRLEVBQVVHLFEsRUFBVTtBQUNwQyxhQUFPLEtBQUtJLE9BQUwsQ0FBYSxXQUFiLEVBQTBCUCxRQUExQixFQUFvQ0csUUFBcEMsQ0FBUDtBQUNEOzs7NEJBRU9LLE0sRUFBd0M7QUFBQSxVQUFoQ1IsUUFBZ0MsdUVBQXJCLEVBQXFCO0FBQUEsVUFBakJHLFFBQWlCLHVFQUFOLElBQU07O0FBQzlDLFVBQUlKLFdBQVMsS0FBS1AsT0FBTCxDQUFhaUIsUUFBdEIsR0FBaUNuQixXQUFyQztBQUNBLFVBQUlvQixZQUFZLEVBQWhCO0FBQ0EsVUFBSVYsU0FBU1csTUFBYixFQUFxQjtBQUNuQkQsa0JBQVVWLFFBQVYsR0FBcUJBLFFBQXJCO0FBQ0Q7QUFDRCxVQUFJRyxhQUFhLElBQWpCLEVBQXVCO0FBQ3JCTyxrQkFBVVAsUUFBVixHQUFxQkEsUUFBckI7QUFDRDtBQUNELFVBQUlWLE9BQU87QUFDVGUsc0JBRFM7QUFFVEksZ0JBQVEsQ0FDTjtBQUNFbEIsY0FBSSxLQUFLQSxFQURYO0FBRUVELGdCQUFNaUI7QUFGUixTQURNO0FBRkMsT0FBWDtBQVNBLGFBQU9HLFVBQVUsS0FBS3JCLE9BQWYsRUFBd0IsVUFBQ3NCLE9BQUQsRUFBYTtBQUMxQyxlQUFPLElBQUlDLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsaUJBQU9oQyxNQUFNaUMsS0FBTixDQUFZbkIsR0FBWixFQUFpQk4sSUFBakIsRUFBdUIsRUFBQ3FCLGdCQUFELEVBQXZCLEVBQ0pLLElBREksQ0FDQyxVQUFDQyxRQUFELEVBQWM7QUFDbEIsZ0JBQUlDLFVBQVVELFFBQVYsQ0FBSixFQUF5QjtBQUN2Qkosc0JBQVEsSUFBSXpCLEtBQUosQ0FBVTZCLFNBQVMzQixJQUFULENBQWM2QixLQUF4QixDQUFSO0FBQ0QsYUFGRCxNQUVPO0FBQ0xMLHFCQUFPRyxRQUFQO0FBQ0Q7QUFDRixXQVBJLEVBT0ZILE1BUEUsQ0FBUDtBQVFELFNBVE0sQ0FBUDtBQVVELE9BWE0sQ0FBUDtBQVlEOzs7Ozs7QUFFSDs7QUFFQU0sT0FBT0MsT0FBUCxHQUFpQmpDLEtBQWpCIiwiZmlsZSI6IklucHV0LmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCBDb25jZXB0cyA9IHJlcXVpcmUoJy4vQ29uY2VwdHMnKTtcbmxldCBSZWdpb25zID0gcmVxdWlyZSgnLi9SZWdpb25zJyk7XG5sZXQge0FQSX0gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtJTlBVVFNfUEFUSH0gPSBBUEk7XG5cbi8qKlxuICogY2xhc3MgcmVwcmVzZW50aW5nIGFuIGlucHV0XG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgSW5wdXQge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5jcmVhdGVkQXQgPSBkYXRhLmNyZWF0ZWRfYXQgfHwgZGF0YS5jcmVhdGVkQXQ7XG4gICAgdGhpcy5pbWFnZVVybCA9IGRhdGEuZGF0YS5pbWFnZS51cmw7XG4gICAgdGhpcy5jb25jZXB0cyA9IG5ldyBDb25jZXB0cyhfY29uZmlnLCBkYXRhLmRhdGEuY29uY2VwdHMpO1xuICAgIHRoaXMucmVnaW9ucyA9IG5ldyBSZWdpb25zKF9jb25maWcsIGRhdGEuZGF0YS5yZWdpb25zIHx8IFtdKTtcbiAgICB0aGlzLnNjb3JlID0gZGF0YS5zY29yZTtcbiAgICB0aGlzLm1ldGFkYXRhID0gZGF0YS5kYXRhLm1ldGFkYXRhO1xuICAgIGlmIChkYXRhLmRhdGEuZ2VvICYmIGRhdGEuZGF0YS5nZW9bJ2dlb19wb2ludCddKSB7XG4gICAgICB0aGlzLmdlbyA9IHtnZW9Qb2ludDogZGF0YS5kYXRhLmdlb1snZ2VvX3BvaW50J119O1xuICAgIH1cbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY29uY2VwdHMgdG8gYW4gaW5wdXRcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBjb25jZXB0cyAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgIFRoZSBjb25jZXB0IGlkIChyZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIG1ldGFkYXRhICAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGtleSB2YWx1ZXMgdG8gYXR0YWNoIHRvIHRoZSBpbnB1dCAob3B0aW9uYWwpXG4gICAqIEByZXR1cm4ge1Byb21pc2UoSW5wdXQsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXQgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbWVyZ2VDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdtZXJnZScsIGNvbmNlcHRzLCBtZXRhZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGNvbmNlcHQgZnJvbSBhbiBpbnB1dFxuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGNvbmNlcHRzICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgbWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5IHZhbHVlcyB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dCBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBkZWxldGVDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdyZW1vdmUnLCBjb25jZXB0cywgbWV0YWRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0ZSBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBjb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICBBcnJheSBvZiBvYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBjb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgIGNvbmNlcHRzW10uY29uY2VwdC52YWx1ZSAgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgbWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5IHZhbHVlcyB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dCBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBvdmVyd3JpdGVDb25jZXB0cyhjb25jZXB0cywgbWV0YWRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCdvdmVyd3JpdGUnLCBjb25jZXB0cywgbWV0YWRhdGEpO1xuICB9XG5cbiAgX3VwZGF0ZShhY3Rpb24sIGNvbmNlcHRzID0gW10sIG1ldGFkYXRhID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtJTlBVVFNfUEFUSH1gO1xuICAgIGxldCBpbnB1dERhdGEgPSB7fTtcbiAgICBpZiAoY29uY2VwdHMubGVuZ3RoKSB7XG4gICAgICBpbnB1dERhdGEuY29uY2VwdHMgPSBjb25jZXB0cztcbiAgICB9XG4gICAgaWYgKG1ldGFkYXRhICE9PSBudWxsKSB7XG4gICAgICBpbnB1dERhdGEubWV0YWRhdGEgPSBtZXRhZGF0YTtcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICBhY3Rpb24sXG4gICAgICBpbnB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgIGRhdGE6IGlucHV0RGF0YVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfTtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5wYXRjaCh1cmwsIGRhdGEsIHtoZWFkZXJzfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUobmV3IElucHV0KHJlc3BvbnNlLmRhdGEuaW5wdXQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXQ7XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Input.js","/")
},{"./Concepts":40,"./Regions":47,"./constants":50,"axios":4,"buffer":23,"pBGvAp":27}],42:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var Input = require('./Input');

var _require = require('./constants'),
    API = _require.API,
    ERRORS = _require.ERRORS,
    MAX_BATCH_SIZE = _require.MAX_BATCH_SIZE,
    replaceVars = _require.replaceVars;

var INPUT_PATH = API.INPUT_PATH,
    INPUTS_PATH = API.INPUTS_PATH,
    INPUTS_STATUS_PATH = API.INPUTS_STATUS_PATH,
    SEARCH_PATH = API.SEARCH_PATH;

var _require2 = require('./utils'),
    wrapToken = _require2.wrapToken,
    formatInput = _require2.formatInput,
    formatImagesSearch = _require2.formatImagesSearch,
    formatConceptsSearch = _require2.formatConceptsSearch;

var _require3 = require('./helpers'),
    isSuccess = _require3.isSuccess,
    checkType = _require3.checkType,
    clone = _require3.clone;

/**
 * class representing a collection of inputs
 * @class
 */


var Inputs = function () {
  function Inputs(_config) {
    var _this = this;

    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Inputs);

    this.rawData = rawData;
    rawData.forEach(function (inputData, index) {
      if (inputData.input && inputData.score) {
        inputData.input.score = inputData.score;
        inputData = inputData.input;
      }
      _this[index] = new Input(_this._config, inputData);
    });
    this.length = rawData.length;
    this._config = _config;
  }

  /**
   * Get all inputs in app
   * @param {Object}    options  Object with keys explained below: (optional)
   *   @param {Number}    options.page  The page number (optional, default: 1)
   *   @param {Number}    options.perPage  Number of images to return per page (optional, default: 20)
   * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
   */


  _createClass(Inputs, [{
    key: 'list',
    value: function list() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + INPUTS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, {
            headers: headers,
            params: {
              page: options.page,
              per_page: options.perPage
            }
          }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Inputs(_this2._config, response.data.inputs));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Adds an input or multiple inputs
     * @param {object|object[]}        inputs                                Can be a single media object or an array of media objects (max of 128 inputs/call; passing > 128 will throw an exception)
     *   @param {object|string}          inputs[].input                        If string, is given, this is assumed to be an image url
     *     @param {string}                 inputs[].input.(url|base64)           Can be a publicly accessibly url or base64 string representing image bytes (required)
     *     @param {string}                 inputs[].input.id                     ID of input (optional)
     *     @param {number[]}               inputs[].input.crop                   An array containing the percent to be cropped from top, left, bottom and right (optional)
     *     @param {object[]}               inputs[].input.metadata               Object with key and values pair (value can be string, array or other objects) to attach to the input (optional)
     *     @param {object}                 inputs[].input.geo                    Object with latitude and longitude coordinates to associate with an input. Can be used in search query as the proximity of an input to a reference point (optional)
     *       @param {number}                 inputs[].input.geo.latitude           +/- latitude val of geodata
     *       @param {number}                 inputs[].input.geo.longitude          +/- longitude val of geodata
     *     @param {object[]}               inputs[].input.concepts               An array of concepts to attach to media object (optional)
     *       @param {object|string}          inputs[].input.concepts[].concept     If string, is given, this is assumed to be concept id with value equals true
     *         @param {string}                 inputs[].input.concepts[].concept.id          The concept id (required)
     *         @param {boolean}                inputs[].input.concepts[].concept.value       Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
     */

  }, {
    key: 'create',
    value: function create(inputs) {
      var _this3 = this;

      if (checkType(/(String|Object)/, inputs)) {
        inputs = [inputs];
      }
      var url = '' + this._config.basePath + INPUTS_PATH;
      if (inputs.length > MAX_BATCH_SIZE) {
        throw ERRORS.MAX_INPUTS;
      }
      return wrapToken(this._config, function (headers) {
        var data = {
          inputs: inputs.map(formatInput)
        };
        return new Promise(function (resolve, reject) {
          axios.post(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Inputs(_this3._config, response.data.inputs));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Get input by id
     * @param {String}    id  The input id
     * @return {Promise(Input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
     */

  }, {
    key: 'get',
    value: function get(id) {
      var _this4 = this;

      var url = '' + this._config.basePath + replaceVars(INPUT_PATH, [id]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Input(_this4._config, response.data.input));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Delete an input or a list of inputs by id or all inputs if no id is passed
     * @param {string|string[]}    id           The id of input to delete (optional)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'delete',
    value: function _delete() {
      var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      var val = void 0;
      // delete an input
      if (checkType(/String/, id)) {
        var url = '' + this._config.basePath + replaceVars(INPUT_PATH, [id]);
        val = wrapToken(this._config, function (headers) {
          return axios.delete(url, { headers: headers });
        });
      } else {
        val = this._deleteInputs(id);
      }
      return val;
    }
  }, {
    key: '_deleteInputs',
    value: function _deleteInputs() {
      var id = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      var url = '' + this._config.basePath + INPUTS_PATH;
      return wrapToken(this._config, function (headers) {
        var data = id === null ? { delete_all: true } : { ids: id };
        return axios({
          url: url,
          method: 'delete',
          headers: headers,
          data: data
        });
      });
    }

    /**
     * Merge concepts to inputs in bulk
     * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
     *   @param {object}           inputs[].input
     *     @param {string}           inputs[].input.id        The id of the input to update
     *     @param {string}           inputs[].input.concepts  Object with keys explained below:
     *       @param {object}           inputs[].input.concepts[].concept
     *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
     *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
     */

  }, {
    key: 'mergeConcepts',
    value: function mergeConcepts(inputs) {
      inputs.action = 'merge';
      return this.update(inputs);
    }

    /**
     * Delete concepts to inputs in bulk
     * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
     *   @param {object}           inputs[].input
     *     @param {string}           inputs[].input.id                           The id of the input to update
     *     @param {string}           inputs[].input.concepts                     Object with keys explained below:
     *       @param {object}           inputs[].input.concepts[].concept
     *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
     *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
     */

  }, {
    key: 'deleteConcepts',
    value: function deleteConcepts(inputs) {
      inputs.action = 'remove';
      return this.update(inputs);
    }

    /**
     * Overwrite inputs in bulk
     * @param {object[]}         inputs    List of concepts to update (max of 128 inputs/call; passing > 128 will throw an exception)
     *   @param {object}           inputs[].input
     *     @param {string}           inputs[].input.id                           The id of the input to update
     *     @param {string}           inputs[].input.concepts                     Object with keys explained below:
     *       @param {object}           inputs[].input.concepts[].concept
     *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
     *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
     */

  }, {
    key: 'overwriteConcepts',
    value: function overwriteConcepts(inputs) {
      inputs.action = 'overwrite';
      return this.update(inputs);
    }

    /**
     * @param {object[]}         inputs    List of inputs to update (max of 128 inputs/call; passing > 128 will throw an exception)
     *   @param {object}           inputs[].input
     *     @param {string}           inputs[].input.id                           The id of the input to update
     *     @param {object}           inputs[].input.metadata                     Object with key values to attach to the input (optional)
     *     @param {object}           inputs[].input.geo                          Object with latitude and longitude coordinates to associate with an input. Can be used in search query as the proximity of an input to a reference point (optional)
     *       @param {number}           inputs[].input.geo.latitude                 +/- latitude val of geodata
     *       @param {number}           inputs[].input.geo.longitude                +/- longitude val of geodata
     *     @param {string}           inputs[].input.concepts                     Object with keys explained below (optional):
     *       @param {object}           inputs[].input.concepts[].concept
     *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
     *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
     * @return {Promise(Inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
     */

  }, {
    key: 'update',
    value: function update(inputs) {
      var _this5 = this;

      var url = '' + this._config.basePath + INPUTS_PATH;
      var inputsList = Array.isArray(inputs) ? inputs : [inputs];
      if (inputsList.length > MAX_BATCH_SIZE) {
        throw ERRORS.MAX_INPUTS;
      }
      var data = {
        action: inputs.action,
        inputs: inputsList.map(function (input) {
          return formatInput(input, false);
        })
      };
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.patch(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Inputs(_this5._config, response.data.inputs));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Search for inputs or outputs based on concepts or images
     *   @param {object[]}               queries          List of all predictions to match with
     *     @param {object}                 queries[].concept            An object with the following keys:
     *       @param {string}                 queries[].concept.id          The concept id
     *       @param {string}                 queries[].concept.type        Search over 'input' to get input matches to criteria or 'output' to get inputs that are visually similar to the criteria (default: 'output')
     *       @param {string}                 queries[].concept.name        The concept name
     *       @param {boolean}                queries[].concept.value       Indicates whether or not the term should match with the prediction returned (default: true)
     *     @param {object}                 queries[].input              An image object that contains the following keys:
     *       @param {string}                 queries[].input.id            The input id
     *       @param {string}                 queries[].input.type          Search over 'input' to get input matches to criteria or 'output' to get inputs that are visually similar to the criteria (default: 'output')
     *       @param {string}                 queries[].input.(base64|url)  Can be a publicly accessibly url or base64 string representing image bytes (required)
     *       @param {number[]}               queries[].input.crop          An array containing the percent to be cropped from top, left, bottom and right (optional)
     *       @param {object}                 queries[].input.metadata      An object with key and value specified by user to refine search with (optional)
     * @param {Object}                   options       Object with keys explained below: (optional)
     *    @param {Number}                  options.page          The page number (optional, default: 1)
     *    @param {Number}                  options.perPage       Number of images to return per page (optional, default: 20)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'search',
    value: function search() {
      var queries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { page: 1, perPage: 20 };

      var formattedAnds = [];
      var url = '' + this._config.basePath + SEARCH_PATH;
      var data = {
        query: {
          ands: []
        },
        pagination: {
          page: options.page,
          per_page: options.perPage
        }
      };

      if (!Array.isArray(queries)) {
        queries = [queries];
      }
      if (queries.length > 0) {
        queries.forEach(function (query) {
          if (query.input) {
            formattedAnds = formattedAnds.concat(formatImagesSearch(query.input));
          } else if (query.concept) {
            formattedAnds = formattedAnds.concat(formatConceptsSearch(query.concept));
          }
        });
        data.query.ands = formattedAnds;
      }
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              var _data = clone(response.data);
              _data.rawData = clone(response.data);
              resolve(_data);
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Get inputs status (number of uploaded, in process or failed inputs)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getStatus',
    value: function getStatus() {
      var url = '' + this._config.basePath + INPUTS_STATUS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              var data = clone(response.data);
              data.rawData = clone(response.data);
              resolve(data);
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }]);

  return Inputs;
}();

;

module.exports = Inputs;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIklucHV0cy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJJbnB1dCIsIkFQSSIsIkVSUk9SUyIsIk1BWF9CQVRDSF9TSVpFIiwicmVwbGFjZVZhcnMiLCJJTlBVVF9QQVRIIiwiSU5QVVRTX1BBVEgiLCJJTlBVVFNfU1RBVFVTX1BBVEgiLCJTRUFSQ0hfUEFUSCIsIndyYXBUb2tlbiIsImZvcm1hdElucHV0IiwiZm9ybWF0SW1hZ2VzU2VhcmNoIiwiZm9ybWF0Q29uY2VwdHNTZWFyY2giLCJpc1N1Y2Nlc3MiLCJjaGVja1R5cGUiLCJjbG9uZSIsIklucHV0cyIsIl9jb25maWciLCJyYXdEYXRhIiwiZm9yRWFjaCIsImlucHV0RGF0YSIsImluZGV4IiwiaW5wdXQiLCJzY29yZSIsImxlbmd0aCIsIm9wdGlvbnMiLCJwYWdlIiwicGVyUGFnZSIsInVybCIsImJhc2VQYXRoIiwiaGVhZGVycyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0IiwicGFyYW1zIiwicGVyX3BhZ2UiLCJ0aGVuIiwicmVzcG9uc2UiLCJkYXRhIiwiaW5wdXRzIiwiTUFYX0lOUFVUUyIsIm1hcCIsInBvc3QiLCJpZCIsInZhbCIsImRlbGV0ZSIsIl9kZWxldGVJbnB1dHMiLCJkZWxldGVfYWxsIiwiaWRzIiwibWV0aG9kIiwiYWN0aW9uIiwidXBkYXRlIiwiaW5wdXRzTGlzdCIsIkFycmF5IiwiaXNBcnJheSIsInBhdGNoIiwicXVlcmllcyIsImZvcm1hdHRlZEFuZHMiLCJxdWVyeSIsImFuZHMiLCJwYWdpbmF0aW9uIiwiY29uY2F0IiwiY29uY2VwdCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQUlBLFFBQVFDLFFBQVEsT0FBUixDQUFaO0FBQ0EsSUFBSUMsUUFBUUQsUUFBUSxTQUFSLENBQVo7O2VBQ2lEQSxRQUFRLGFBQVIsQztJQUE1Q0UsRyxZQUFBQSxHO0lBQUtDLE0sWUFBQUEsTTtJQUFRQyxjLFlBQUFBLGM7SUFBZ0JDLFcsWUFBQUEsVzs7SUFDN0JDLFUsR0FBNERKLEcsQ0FBNURJLFU7SUFBWUMsVyxHQUFnREwsRyxDQUFoREssVztJQUFhQyxrQixHQUFtQ04sRyxDQUFuQ00sa0I7SUFBb0JDLFcsR0FBZVAsRyxDQUFmTyxXOztnQkFDdUJULFFBQVEsU0FBUixDO0lBQXBFVSxTLGFBQUFBLFM7SUFBV0MsVyxhQUFBQSxXO0lBQWFDLGtCLGFBQUFBLGtCO0lBQW9CQyxvQixhQUFBQSxvQjs7Z0JBQ2JiLFFBQVEsV0FBUixDO0lBQS9CYyxTLGFBQUFBLFM7SUFBV0MsUyxhQUFBQSxTO0lBQVdDLEssYUFBQUEsSzs7QUFFM0I7Ozs7OztJQUlNQyxNO0FBQ0osa0JBQVlDLE9BQVosRUFBbUM7QUFBQTs7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pDLFNBQUtBLE9BQUwsR0FBZUEsT0FBZjtBQUNBQSxZQUFRQyxPQUFSLENBQWdCLFVBQUNDLFNBQUQsRUFBWUMsS0FBWixFQUFzQjtBQUNwQyxVQUFJRCxVQUFVRSxLQUFWLElBQW1CRixVQUFVRyxLQUFqQyxFQUF3QztBQUN0Q0gsa0JBQVVFLEtBQVYsQ0FBZ0JDLEtBQWhCLEdBQXdCSCxVQUFVRyxLQUFsQztBQUNBSCxvQkFBWUEsVUFBVUUsS0FBdEI7QUFDRDtBQUNELFlBQUtELEtBQUwsSUFBYyxJQUFJckIsS0FBSixDQUFVLE1BQUtpQixPQUFmLEVBQXdCRyxTQUF4QixDQUFkO0FBQ0QsS0FORDtBQU9BLFNBQUtJLE1BQUwsR0FBY04sUUFBUU0sTUFBdEI7QUFDQSxTQUFLUCxPQUFMLEdBQWVBLE9BQWY7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7MkJBT3VDO0FBQUE7O0FBQUEsVUFBbENRLE9BQWtDLHVFQUF4QixFQUFDQyxNQUFNLENBQVAsRUFBVUMsU0FBUyxFQUFuQixFQUF3Qjs7QUFDckMsVUFBSUMsV0FBUyxLQUFLWCxPQUFMLENBQWFZLFFBQXRCLEdBQWlDdkIsV0FBckM7QUFDQSxhQUFPRyxVQUFVLEtBQUtRLE9BQWYsRUFBd0IsVUFBQ2EsT0FBRCxFQUFhO0FBQzFDLGVBQU8sSUFBSUMsT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0Q25DLGdCQUFNb0MsR0FBTixDQUFVTixHQUFWLEVBQWU7QUFDYkUsNEJBRGE7QUFFYkssb0JBQVE7QUFDTlQsb0JBQU1ELFFBQVFDLElBRFI7QUFFTlUsd0JBQVVYLFFBQVFFO0FBRlo7QUFGSyxXQUFmLEVBTUdVLElBTkgsQ0FNUSxVQUFDQyxRQUFELEVBQWM7QUFDcEIsZ0JBQUl6QixVQUFVeUIsUUFBVixDQUFKLEVBQXlCO0FBQ3ZCTixzQkFBUSxJQUFJaEIsTUFBSixDQUFXLE9BQUtDLE9BQWhCLEVBQXlCcUIsU0FBU0MsSUFBVCxDQUFjQyxNQUF2QyxDQUFSO0FBQ0QsYUFGRCxNQUVPO0FBQ0xQLHFCQUFPSyxRQUFQO0FBQ0Q7QUFDRixXQVpELEVBWUdMLE1BWkg7QUFhRCxTQWRNLENBQVA7QUFlRCxPQWhCTSxDQUFQO0FBaUJEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsyQkFpQk9PLE0sRUFBUTtBQUFBOztBQUNiLFVBQUkxQixVQUFVLGlCQUFWLEVBQTZCMEIsTUFBN0IsQ0FBSixFQUEwQztBQUN4Q0EsaUJBQVMsQ0FBQ0EsTUFBRCxDQUFUO0FBQ0Q7QUFDRCxVQUFJWixXQUFTLEtBQUtYLE9BQUwsQ0FBYVksUUFBdEIsR0FBaUN2QixXQUFyQztBQUNBLFVBQUlrQyxPQUFPaEIsTUFBUCxHQUFnQnJCLGNBQXBCLEVBQW9DO0FBQ2xDLGNBQU1ELE9BQU91QyxVQUFiO0FBQ0Q7QUFDRCxhQUFPaEMsVUFBVSxLQUFLUSxPQUFmLEVBQXdCLFVBQUNhLE9BQUQsRUFBYTtBQUMxQyxZQUFJUyxPQUFPO0FBQ1RDLGtCQUFRQSxPQUFPRSxHQUFQLENBQVdoQyxXQUFYO0FBREMsU0FBWDtBQUdBLGVBQU8sSUFBSXFCLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdENuQyxnQkFBTTZDLElBQU4sQ0FBV2YsR0FBWCxFQUFnQlcsSUFBaEIsRUFBc0IsRUFBQ1QsZ0JBQUQsRUFBdEIsRUFDR08sSUFESCxDQUNRLFVBQUNDLFFBQUQsRUFBYztBQUNsQixnQkFBSXpCLFVBQVV5QixRQUFWLENBQUosRUFBeUI7QUFDdkJOLHNCQUFRLElBQUloQixNQUFKLENBQVcsT0FBS0MsT0FBaEIsRUFBeUJxQixTQUFTQyxJQUFULENBQWNDLE1BQXZDLENBQVI7QUFDRCxhQUZELE1BRU87QUFDTFAscUJBQU9LLFFBQVA7QUFDRDtBQUNGLFdBUEgsRUFPS0wsTUFQTDtBQVFELFNBVE0sQ0FBUDtBQVVELE9BZE0sQ0FBUDtBQWVEOztBQUVEOzs7Ozs7Ozt3QkFLSVcsRSxFQUFJO0FBQUE7O0FBQ04sVUFBSWhCLFdBQVMsS0FBS1gsT0FBTCxDQUFhWSxRQUF0QixHQUFpQ3pCLFlBQVlDLFVBQVosRUFBd0IsQ0FBQ3VDLEVBQUQsQ0FBeEIsQ0FBckM7QUFDQSxhQUFPbkMsVUFBVSxLQUFLUSxPQUFmLEVBQXdCLFVBQUNhLE9BQUQsRUFBYTtBQUMxQyxlQUFPLElBQUlDLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdENuQyxnQkFBTW9DLEdBQU4sQ0FBVU4sR0FBVixFQUFlLEVBQUNFLGdCQUFELEVBQWYsRUFBMEJPLElBQTFCLENBQStCLFVBQUNDLFFBQUQsRUFBYztBQUMzQyxnQkFBSXpCLFVBQVV5QixRQUFWLENBQUosRUFBeUI7QUFDdkJOLHNCQUFRLElBQUloQyxLQUFKLENBQVUsT0FBS2lCLE9BQWYsRUFBd0JxQixTQUFTQyxJQUFULENBQWNqQixLQUF0QyxDQUFSO0FBQ0QsYUFGRCxNQUVPO0FBQ0xXLHFCQUFPSyxRQUFQO0FBQ0Q7QUFDRixXQU5ELEVBTUdMLE1BTkg7QUFPRCxTQVJNLENBQVA7QUFTRCxPQVZNLENBQVA7QUFXRDs7QUFFRDs7Ozs7Ozs7OEJBS2tCO0FBQUEsVUFBWFcsRUFBVyx1RUFBTixJQUFNOztBQUNoQixVQUFJQyxZQUFKO0FBQ0E7QUFDQSxVQUFJL0IsVUFBVSxRQUFWLEVBQW9COEIsRUFBcEIsQ0FBSixFQUE2QjtBQUMzQixZQUFJaEIsV0FBUyxLQUFLWCxPQUFMLENBQWFZLFFBQXRCLEdBQWlDekIsWUFBWUMsVUFBWixFQUF3QixDQUFDdUMsRUFBRCxDQUF4QixDQUFyQztBQUNBQyxjQUFNcEMsVUFBVSxLQUFLUSxPQUFmLEVBQXdCLFVBQUNhLE9BQUQsRUFBYTtBQUN6QyxpQkFBT2hDLE1BQU1nRCxNQUFOLENBQWFsQixHQUFiLEVBQWtCLEVBQUNFLGdCQUFELEVBQWxCLENBQVA7QUFDRCxTQUZLLENBQU47QUFHRCxPQUxELE1BS087QUFDTGUsY0FBTSxLQUFLRSxhQUFMLENBQW1CSCxFQUFuQixDQUFOO0FBQ0Q7QUFDRCxhQUFPQyxHQUFQO0FBQ0Q7OztvQ0FFd0I7QUFBQSxVQUFYRCxFQUFXLHVFQUFOLElBQU07O0FBQ3ZCLFVBQUloQixXQUFTLEtBQUtYLE9BQUwsQ0FBYVksUUFBdEIsR0FBaUN2QixXQUFyQztBQUNBLGFBQU9HLFVBQVUsS0FBS1EsT0FBZixFQUF3QixVQUFDYSxPQUFELEVBQWE7QUFDMUMsWUFBSVMsT0FBT0ssT0FBTyxJQUFQLEdBQWMsRUFBQ0ksWUFBWSxJQUFiLEVBQWQsR0FDVCxFQUFDQyxLQUFLTCxFQUFOLEVBREY7QUFFQSxlQUFPOUMsTUFBTTtBQUNYOEIsa0JBRFc7QUFFWHNCLGtCQUFRLFFBRkc7QUFHWHBCLDBCQUhXO0FBSVhTO0FBSlcsU0FBTixDQUFQO0FBTUQsT0FUTSxDQUFQO0FBVUQ7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O2tDQVdjQyxNLEVBQVE7QUFDcEJBLGFBQU9XLE1BQVAsR0FBZ0IsT0FBaEI7QUFDQSxhQUFPLEtBQUtDLE1BQUwsQ0FBWVosTUFBWixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O21DQVdlQSxNLEVBQVE7QUFDckJBLGFBQU9XLE1BQVAsR0FBZ0IsUUFBaEI7QUFDQSxhQUFPLEtBQUtDLE1BQUwsQ0FBWVosTUFBWixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O3NDQVdrQkEsTSxFQUFRO0FBQ3hCQSxhQUFPVyxNQUFQLEdBQWdCLFdBQWhCO0FBQ0EsYUFBTyxLQUFLQyxNQUFMLENBQVlaLE1BQVosQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7OzsyQkFjT0EsTSxFQUFRO0FBQUE7O0FBQ2IsVUFBSVosV0FBUyxLQUFLWCxPQUFMLENBQWFZLFFBQXRCLEdBQWlDdkIsV0FBckM7QUFDQSxVQUFJK0MsYUFBYUMsTUFBTUMsT0FBTixDQUFjZixNQUFkLElBQXdCQSxNQUF4QixHQUFpQyxDQUFDQSxNQUFELENBQWxEO0FBQ0EsVUFBSWEsV0FBVzdCLE1BQVgsR0FBb0JyQixjQUF4QixFQUF3QztBQUN0QyxjQUFNRCxPQUFPdUMsVUFBYjtBQUNEO0FBQ0QsVUFBSUYsT0FBTztBQUNUWSxnQkFBUVgsT0FBT1csTUFETjtBQUVUWCxnQkFBUWEsV0FBV1gsR0FBWCxDQUFlLFVBQUNwQixLQUFEO0FBQUEsaUJBQVdaLFlBQVlZLEtBQVosRUFBbUIsS0FBbkIsQ0FBWDtBQUFBLFNBQWY7QUFGQyxPQUFYO0FBSUEsYUFBT2IsVUFBVSxLQUFLUSxPQUFmLEVBQXdCLFVBQUNhLE9BQUQsRUFBYTtBQUMxQyxlQUFPLElBQUlDLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdENuQyxnQkFBTTBELEtBQU4sQ0FBWTVCLEdBQVosRUFBaUJXLElBQWpCLEVBQXVCLEVBQUNULGdCQUFELEVBQXZCLEVBQ0dPLElBREgsQ0FDUSxVQUFDQyxRQUFELEVBQWM7QUFDbEIsZ0JBQUl6QixVQUFVeUIsUUFBVixDQUFKLEVBQXlCO0FBQ3ZCTixzQkFBUSxJQUFJaEIsTUFBSixDQUFXLE9BQUtDLE9BQWhCLEVBQXlCcUIsU0FBU0MsSUFBVCxDQUFjQyxNQUF2QyxDQUFSO0FBQ0QsYUFGRCxNQUVPO0FBQ0xQLHFCQUFPSyxRQUFQO0FBQ0Q7QUFDRixXQVBILEVBT0tMLE1BUEw7QUFRRCxTQVRNLENBQVA7QUFVRCxPQVhNLENBQVA7QUFZRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs2QkFtQnVEO0FBQUEsVUFBaER3QixPQUFnRCx1RUFBdEMsRUFBc0M7QUFBQSxVQUFsQ2hDLE9BQWtDLHVFQUF4QixFQUFDQyxNQUFNLENBQVAsRUFBVUMsU0FBUyxFQUFuQixFQUF3Qjs7QUFDckQsVUFBSStCLGdCQUFnQixFQUFwQjtBQUNBLFVBQUk5QixXQUFTLEtBQUtYLE9BQUwsQ0FBYVksUUFBdEIsR0FBaUNyQixXQUFyQztBQUNBLFVBQUkrQixPQUFPO0FBQ1RvQixlQUFPO0FBQ0xDLGdCQUFNO0FBREQsU0FERTtBQUlUQyxvQkFBWTtBQUNWbkMsZ0JBQU1ELFFBQVFDLElBREo7QUFFVlUsb0JBQVVYLFFBQVFFO0FBRlI7QUFKSCxPQUFYOztBQVVBLFVBQUksQ0FBQzJCLE1BQU1DLE9BQU4sQ0FBY0UsT0FBZCxDQUFMLEVBQTZCO0FBQzNCQSxrQkFBVSxDQUFDQSxPQUFELENBQVY7QUFDRDtBQUNELFVBQUlBLFFBQVFqQyxNQUFSLEdBQWlCLENBQXJCLEVBQXdCO0FBQ3RCaUMsZ0JBQVF0QyxPQUFSLENBQWdCLFVBQVN3QyxLQUFULEVBQWdCO0FBQzlCLGNBQUlBLE1BQU1yQyxLQUFWLEVBQWlCO0FBQ2ZvQyw0QkFBZ0JBLGNBQWNJLE1BQWQsQ0FBcUJuRCxtQkFBbUJnRCxNQUFNckMsS0FBekIsQ0FBckIsQ0FBaEI7QUFDRCxXQUZELE1BRU8sSUFBSXFDLE1BQU1JLE9BQVYsRUFBbUI7QUFDeEJMLDRCQUFnQkEsY0FBY0ksTUFBZCxDQUFxQmxELHFCQUFxQitDLE1BQU1JLE9BQTNCLENBQXJCLENBQWhCO0FBQ0Q7QUFDRixTQU5EO0FBT0F4QixhQUFLb0IsS0FBTCxDQUFXQyxJQUFYLEdBQWtCRixhQUFsQjtBQUNEO0FBQ0QsYUFBT2pELFVBQVUsS0FBS1EsT0FBZixFQUF3QixVQUFDYSxPQUFELEVBQWE7QUFDMUMsZUFBTyxJQUFJQyxPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDbkMsZ0JBQU02QyxJQUFOLENBQVdmLEdBQVgsRUFBZ0JXLElBQWhCLEVBQXNCLEVBQUNULGdCQUFELEVBQXRCLEVBQ0dPLElBREgsQ0FDUSxVQUFDQyxRQUFELEVBQWM7QUFDbEIsZ0JBQUl6QixVQUFVeUIsUUFBVixDQUFKLEVBQXlCO0FBQ3ZCLGtCQUFJQyxRQUFPeEIsTUFBTXVCLFNBQVNDLElBQWYsQ0FBWDtBQUNBQSxvQkFBS3JCLE9BQUwsR0FBZUgsTUFBTXVCLFNBQVNDLElBQWYsQ0FBZjtBQUNBUCxzQkFBUU8sS0FBUjtBQUNELGFBSkQsTUFJTztBQUNMTixxQkFBT0ssUUFBUDtBQUNEO0FBQ0YsV0FUSCxFQVNLTCxNQVRMO0FBVUQsU0FYTSxDQUFQO0FBWUQsT0FiTSxDQUFQO0FBY0Q7O0FBRUQ7Ozs7Ozs7Z0NBSVk7QUFDVixVQUFJTCxXQUFTLEtBQUtYLE9BQUwsQ0FBYVksUUFBdEIsR0FBaUN0QixrQkFBckM7QUFDQSxhQUFPRSxVQUFVLEtBQUtRLE9BQWYsRUFBd0IsVUFBQ2EsT0FBRCxFQUFhO0FBQzFDLGVBQU8sSUFBSUMsT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0Q25DLGdCQUFNb0MsR0FBTixDQUFVTixHQUFWLEVBQWUsRUFBQ0UsZ0JBQUQsRUFBZixFQUNHTyxJQURILENBQ1EsVUFBQ0MsUUFBRCxFQUFjO0FBQ2xCLGdCQUFJekIsVUFBVXlCLFFBQVYsQ0FBSixFQUF5QjtBQUN2QixrQkFBSUMsT0FBT3hCLE1BQU11QixTQUFTQyxJQUFmLENBQVg7QUFDQUEsbUJBQUtyQixPQUFMLEdBQWVILE1BQU11QixTQUFTQyxJQUFmLENBQWY7QUFDQVAsc0JBQVFPLElBQVI7QUFDRCxhQUpELE1BSU87QUFDTE4scUJBQU9LLFFBQVA7QUFDRDtBQUNGLFdBVEgsRUFTS0wsTUFUTDtBQVVELFNBWE0sQ0FBUDtBQVlELE9BYk0sQ0FBUDtBQWNEOzs7Ozs7QUFFSDs7QUFFQStCLE9BQU9DLE9BQVAsR0FBaUJqRCxNQUFqQiIsImZpbGUiOiJJbnB1dHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IElucHV0ID0gcmVxdWlyZSgnLi9JbnB1dCcpO1xubGV0IHtBUEksIEVSUk9SUywgTUFYX0JBVENIX1NJWkUsIHJlcGxhY2VWYXJzfSA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XG5sZXQge0lOUFVUX1BBVEgsIElOUFVUU19QQVRILCBJTlBVVFNfU1RBVFVTX1BBVEgsIFNFQVJDSF9QQVRIfSA9IEFQSTtcbmxldCB7d3JhcFRva2VuLCBmb3JtYXRJbnB1dCwgZm9ybWF0SW1hZ2VzU2VhcmNoLCBmb3JtYXRDb25jZXB0c1NlYXJjaH0gPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5sZXQge2lzU3VjY2VzcywgY2hlY2tUeXBlLCBjbG9uZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSBjb2xsZWN0aW9uIG9mIGlucHV0c1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIElucHV0cyB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIHJhd0RhdGEgPSBbXSkge1xuICAgIHRoaXMucmF3RGF0YSA9IHJhd0RhdGE7XG4gICAgcmF3RGF0YS5mb3JFYWNoKChpbnB1dERhdGEsIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5wdXREYXRhLmlucHV0ICYmIGlucHV0RGF0YS5zY29yZSkge1xuICAgICAgICBpbnB1dERhdGEuaW5wdXQuc2NvcmUgPSBpbnB1dERhdGEuc2NvcmU7XG4gICAgICAgIGlucHV0RGF0YSA9IGlucHV0RGF0YS5pbnB1dDtcbiAgICAgIH1cbiAgICAgIHRoaXNbaW5kZXhdID0gbmV3IElucHV0KHRoaXMuX2NvbmZpZywgaW5wdXREYXRhKTtcbiAgICB9KTtcbiAgICB0aGlzLmxlbmd0aCA9IHJhd0RhdGEubGVuZ3RoO1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBpbnB1dHMgaW4gYXBwXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICBvcHRpb25zICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICBvcHRpb25zLnBhZ2UgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtOdW1iZXJ9ICAgIG9wdGlvbnMucGVyUGFnZSAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGxpc3Qob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7SU5QVVRTX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgcGFnZTogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgcGVyX3BhZ2U6IG9wdGlvbnMucGVyUGFnZSxcbiAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IElucHV0cyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEuaW5wdXRzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiBpbnB1dCBvciBtdWx0aXBsZSBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgICBpbnB1dHMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENhbiBiZSBhIHNpbmdsZSBtZWRpYSBvYmplY3Qgb3IgYW4gYXJyYXkgb2YgbWVkaWEgb2JqZWN0cyAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdHxzdHJpbmd9ICAgICAgICAgIGlucHV0c1tdLmlucHV0ICAgICAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nLCBpcyBnaXZlbiwgdGhpcyBpcyBhc3N1bWVkIHRvIGJlIGFuIGltYWdlIHVybFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC4odXJsfGJhc2U2NCkgICAgICAgICAgIENhbiBiZSBhIHB1YmxpY2x5IGFjY2Vzc2libHkgdXJsIG9yIGJhc2U2NCBzdHJpbmcgcmVwcmVzZW50aW5nIGltYWdlIGJ5dGVzIChyZXF1aXJlZClcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuaWQgICAgICAgICAgICAgICAgICAgICBJRCBvZiBpbnB1dCAob3B0aW9uYWwpXG4gICAqICAgICBAcGFyYW0ge251bWJlcltdfSAgICAgICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNyb3AgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgY29udGFpbmluZyB0aGUgcGVyY2VudCB0byBiZSBjcm9wcGVkIGZyb20gdG9wLCBsZWZ0LCBib3R0b20gYW5kIHJpZ2h0IChvcHRpb25hbClcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQubWV0YWRhdGEgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXkgYW5kIHZhbHVlcyBwYWlyICh2YWx1ZSBjYW4gYmUgc3RyaW5nLCBhcnJheSBvciBvdGhlciBvYmplY3RzKSB0byBhdHRhY2ggdG8gdGhlIGlucHV0IChvcHRpb25hbClcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuZ2VvICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBsYXRpdHVkZSBhbmQgbG9uZ2l0dWRlIGNvb3JkaW5hdGVzIHRvIGFzc29jaWF0ZSB3aXRoIGFuIGlucHV0LiBDYW4gYmUgdXNlZCBpbiBzZWFyY2ggcXVlcnkgYXMgdGhlIHByb3hpbWl0eSBvZiBhbiBpbnB1dCB0byBhIHJlZmVyZW5jZSBwb2ludCAob3B0aW9uYWwpXG4gICAqICAgICAgIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuZ2VvLmxhdGl0dWRlICAgICAgICAgICArLy0gbGF0aXR1ZGUgdmFsIG9mIGdlb2RhdGFcbiAgICogICAgICAgQHBhcmFtIHtudW1iZXJ9ICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8ubG9uZ2l0dWRlICAgICAgICAgICsvLSBsb25naXR1ZGUgdmFsIG9mIGdlb2RhdGFcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICBBbiBhcnJheSBvZiBjb25jZXB0cyB0byBhdHRhY2ggdG8gbWVkaWEgb2JqZWN0IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQgICAgIElmIHN0cmluZywgaXMgZ2l2ZW4sIHRoaXMgaXMgYXNzdW1lZCB0byBiZSBjb25jZXB0IGlkIHdpdGggdmFsdWUgZXF1YWxzIHRydWVcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgICAgV2hldGhlciBvciBub3QgdGhlIGlucHV0IGlzIGEgcG9zaXRpdmUgKHRydWUpIG9yIG5lZ2F0aXZlIChmYWxzZSkgZXhhbXBsZSBvZiB0aGUgY29uY2VwdCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGNyZWF0ZShpbnB1dHMpIHtcbiAgICBpZiAoY2hlY2tUeXBlKC8oU3RyaW5nfE9iamVjdCkvLCBpbnB1dHMpKSB7XG4gICAgICBpbnB1dHMgPSBbaW5wdXRzXTtcbiAgICB9XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke0lOUFVUU19QQVRIfWA7XG4gICAgaWYgKGlucHV0cy5sZW5ndGggPiBNQVhfQkFUQ0hfU0laRSkge1xuICAgICAgdGhyb3cgRVJST1JTLk1BWF9JTlBVVFM7XG4gICAgfVxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IGRhdGEgPSB7XG4gICAgICAgIGlucHV0czogaW5wdXRzLm1hcChmb3JtYXRJbnB1dClcbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgZGF0YSwge2hlYWRlcnN9KVxuICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShuZXcgSW5wdXRzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5pbnB1dHMpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBpbnB1dCBieSBpZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgaWQgIFRoZSBpbnB1dCBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0LCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIElucHV0IG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhJTlBVVF9QQVRILCBbaWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyBJbnB1dCh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEuaW5wdXQpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgYW4gaW5wdXQgb3IgYSBsaXN0IG9mIGlucHV0cyBieSBpZCBvciBhbGwgaW5wdXRzIGlmIG5vIGlkIGlzIHBhc3NlZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gICAgaWQgICAgICAgICAgIFRoZSBpZCBvZiBpbnB1dCB0byBkZWxldGUgKG9wdGlvbmFsKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZGVsZXRlKGlkID0gbnVsbCkge1xuICAgIGxldCB2YWw7XG4gICAgLy8gZGVsZXRlIGFuIGlucHV0XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgaWQpKSB7XG4gICAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoSU5QVVRfUEFUSCwgW2lkXSl9YDtcbiAgICAgIHZhbCA9IHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5kZWxldGUodXJsLCB7aGVhZGVyc30pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbCA9IHRoaXMuX2RlbGV0ZUlucHV0cyhpZCk7XG4gICAgfVxuICAgIHJldHVybiB2YWw7XG4gIH1cblxuICBfZGVsZXRlSW5wdXRzKGlkID0gbnVsbCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtJTlBVVFNfUEFUSH1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IGRhdGEgPSBpZCA9PT0gbnVsbCA/IHtkZWxldGVfYWxsOiB0cnVlfSA6XG4gICAgICAgIHtpZHM6IGlkfTtcbiAgICAgIHJldHVybiBheGlvcyh7XG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnZGVsZXRlJyxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgZGF0YVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY29uY2VwdHMgdG8gaW5wdXRzIGluIGJ1bGtcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICBpbnB1dHMgICAgTGlzdCBvZiBjb25jZXB0cyB0byB1cGRhdGUgKG1heCBvZiAxMjggaW5wdXRzL2NhbGw7IHBhc3NpbmcgPiAxMjggd2lsbCB0aHJvdyBhbiBleGNlcHRpb24pXG4gICAqICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dFxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5pZCAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdFxuICAgKiAgICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgICBUaGUgY29uY2VwdCBpZCAocmVxdWlyZWQpXG4gICAqICAgICAgICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQudmFsdWUgICAgIFdoZXRoZXIgb3Igbm90IHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlICh0cnVlKSBvciBuZWdhdGl2ZSAoZmFsc2UpIGV4YW1wbGUgb2YgdGhlIGNvbmNlcHQgKGRlZmF1bHQ6IHRydWUpXG4gICAqIEByZXR1cm4ge1Byb21pc2UoSW5wdXRzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIElucHV0cyBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBtZXJnZUNvbmNlcHRzKGlucHV0cykge1xuICAgIGlucHV0cy5hY3Rpb24gPSAnbWVyZ2UnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBjb25jZXB0cyB0byBpbnB1dHMgaW4gYnVsa1xuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGlucHV0cyAgICBMaXN0IG9mIGNvbmNlcHRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHRcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0cywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZGVsZXRlQ29uY2VwdHMoaW5wdXRzKSB7XG4gICAgaW5wdXRzLmFjdGlvbiA9ICdyZW1vdmUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0ZSBpbnB1dHMgaW4gYnVsa1xuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgIGlucHV0cyAgICBMaXN0IG9mIGNvbmNlcHRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHMgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHRcbiAgICogICAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgVGhlIGNvbmNlcHQgaWQgKHJlcXVpcmVkKVxuICAgKiAgICAgICAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0LnZhbHVlICAgICBXaGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgaXMgYSBwb3NpdGl2ZSAodHJ1ZSkgb3IgbmVnYXRpdmUgKGZhbHNlKSBleGFtcGxlIG9mIHRoZSBjb25jZXB0IChkZWZhdWx0OiB0cnVlKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKElucHV0cywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBJbnB1dHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgb3ZlcndyaXRlQ29uY2VwdHMoaW5wdXRzKSB7XG4gICAgaW5wdXRzLmFjdGlvbiA9ICdvdmVyd3JpdGUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShpbnB1dHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgaW5wdXRzICAgIExpc3Qgb2YgaW5wdXRzIHRvIHVwZGF0ZSAobWF4IG9mIDEyOCBpbnB1dHMvY2FsbDsgcGFzc2luZyA+IDEyOCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbilcbiAgICogICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgIGlucHV0c1tdLmlucHV0XG4gICAqICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIGlucHV0c1tdLmlucHV0LmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBpbnB1dCB0byB1cGRhdGVcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQubWV0YWRhdGEgICAgICAgICAgICAgICAgICAgICBPYmplY3Qgd2l0aCBrZXkgdmFsdWVzIHRvIGF0dGFjaCB0byB0aGUgaW5wdXQgKG9wdGlvbmFsKVxuICAgKiAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8gICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGxhdGl0dWRlIGFuZCBsb25naXR1ZGUgY29vcmRpbmF0ZXMgdG8gYXNzb2NpYXRlIHdpdGggYW4gaW5wdXQuIENhbiBiZSB1c2VkIGluIHNlYXJjaCBxdWVyeSBhcyB0aGUgcHJveGltaXR5IG9mIGFuIGlucHV0IHRvIGEgcmVmZXJlbmNlIHBvaW50IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtudW1iZXJ9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5nZW8ubGF0aXR1ZGUgICAgICAgICAgICAgICAgICsvLSBsYXRpdHVkZSB2YWwgb2YgZ2VvZGF0YVxuICAgKiAgICAgICBAcGFyYW0ge251bWJlcn0gICAgICAgICAgIGlucHV0c1tdLmlucHV0Lmdlby5sb25naXR1ZGUgICAgICAgICAgICAgICAgKy8tIGxvbmdpdHVkZSB2YWwgb2YgZ2VvZGF0YVxuICAgKiAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93IChvcHRpb25hbCk6XG4gICAqICAgICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgaW5wdXRzW10uaW5wdXQuY29uY2VwdHNbXS5jb25jZXB0XG4gICAqICAgICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICBpbnB1dHNbXS5pbnB1dC5jb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgIFRoZSBjb25jZXB0IGlkIChyZXF1aXJlZClcbiAgICogICAgICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgIGlucHV0c1tdLmlucHV0LmNvbmNlcHRzW10uY29uY2VwdC52YWx1ZSAgICAgV2hldGhlciBvciBub3QgdGhlIGlucHV0IGlzIGEgcG9zaXRpdmUgKHRydWUpIG9yIG5lZ2F0aXZlIChmYWxzZSkgZXhhbXBsZSBvZiB0aGUgY29uY2VwdCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogQHJldHVybiB7UHJvbWlzZShJbnB1dHMsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgSW5wdXRzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIHVwZGF0ZShpbnB1dHMpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7SU5QVVRTX1BBVEh9YDtcbiAgICBsZXQgaW5wdXRzTGlzdCA9IEFycmF5LmlzQXJyYXkoaW5wdXRzKSA/IGlucHV0cyA6IFtpbnB1dHNdO1xuICAgIGlmIChpbnB1dHNMaXN0Lmxlbmd0aCA+IE1BWF9CQVRDSF9TSVpFKSB7XG4gICAgICB0aHJvdyBFUlJPUlMuTUFYX0lOUFVUUztcbiAgICB9XG4gICAgbGV0IGRhdGEgPSB7XG4gICAgICBhY3Rpb246IGlucHV0cy5hY3Rpb24sXG4gICAgICBpbnB1dHM6IGlucHV0c0xpc3QubWFwKChpbnB1dCkgPT4gZm9ybWF0SW5wdXQoaW5wdXQsIGZhbHNlKSlcbiAgICB9O1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7aGVhZGVyc30pXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgICByZXNvbHZlKG5ldyBJbnB1dHModGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLmlucHV0cykpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoIGZvciBpbnB1dHMgb3Igb3V0cHV0cyBiYXNlZCBvbiBjb25jZXB0cyBvciBpbWFnZXNcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICAgIHF1ZXJpZXMgICAgICAgICAgTGlzdCBvZiBhbGwgcHJlZGljdGlvbnMgdG8gbWF0Y2ggd2l0aFxuICAgKiAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uY29uY2VwdCAgICAgICAgICAgIEFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uY29uY2VwdC5pZCAgICAgICAgICBUaGUgY29uY2VwdCBpZFxuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIHF1ZXJpZXNbXS5jb25jZXB0LnR5cGUgICAgICAgIFNlYXJjaCBvdmVyICdpbnB1dCcgdG8gZ2V0IGlucHV0IG1hdGNoZXMgdG8gY3JpdGVyaWEgb3IgJ291dHB1dCcgdG8gZ2V0IGlucHV0cyB0aGF0IGFyZSB2aXN1YWxseSBzaW1pbGFyIHRvIHRoZSBjcml0ZXJpYSAoZGVmYXVsdDogJ291dHB1dCcpXG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmNvbmNlcHQubmFtZSAgICAgICAgVGhlIGNvbmNlcHQgbmFtZVxuICAgKiAgICAgICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICAgIHF1ZXJpZXNbXS5jb25jZXB0LnZhbHVlICAgICAgIEluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0aGUgdGVybSBzaG91bGQgbWF0Y2ggd2l0aCB0aGUgcHJlZGljdGlvbiByZXR1cm5lZCAoZGVmYXVsdDogdHJ1ZSlcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0ICAgICAgICAgICAgICBBbiBpbWFnZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LmlkICAgICAgICAgICAgVGhlIGlucHV0IGlkXG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LnR5cGUgICAgICAgICAgU2VhcmNoIG92ZXIgJ2lucHV0JyB0byBnZXQgaW5wdXQgbWF0Y2hlcyB0byBjcml0ZXJpYSBvciAnb3V0cHV0JyB0byBnZXQgaW5wdXRzIHRoYXQgYXJlIHZpc3VhbGx5IHNpbWlsYXIgdG8gdGhlIGNyaXRlcmlhIChkZWZhdWx0OiAnb3V0cHV0JylcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uaW5wdXQuKGJhc2U2NHx1cmwpICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqICAgICAgIEBwYXJhbSB7bnVtYmVyW119ICAgICAgICAgICAgICAgcXVlcmllc1tdLmlucHV0LmNyb3AgICAgICAgICAgQW4gYXJyYXkgY29udGFpbmluZyB0aGUgcGVyY2VudCB0byBiZSBjcm9wcGVkIGZyb20gdG9wLCBsZWZ0LCBib3R0b20gYW5kIHJpZ2h0IChvcHRpb25hbClcbiAgICogICAgICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICBxdWVyaWVzW10uaW5wdXQubWV0YWRhdGEgICAgICBBbiBvYmplY3Qgd2l0aCBrZXkgYW5kIHZhbHVlIHNwZWNpZmllZCBieSB1c2VyIHRvIHJlZmluZSBzZWFyY2ggd2l0aCAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgICAgICBvcHRpb25zICAgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OiAob3B0aW9uYWwpXG4gICAqICAgIEBwYXJhbSB7TnVtYmVyfSAgICAgICAgICAgICAgICAgIG9wdGlvbnMucGFnZSAgICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgICBAcGFyYW0ge051bWJlcn0gICAgICAgICAgICAgICAgICBvcHRpb25zLnBlclBhZ2UgICAgICAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIHNlYXJjaChxdWVyaWVzID0gW10sIG9wdGlvbnMgPSB7cGFnZTogMSwgcGVyUGFnZTogMjB9KSB7XG4gICAgbGV0IGZvcm1hdHRlZEFuZHMgPSBbXTtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7U0VBUkNIX1BBVEh9YDtcbiAgICBsZXQgZGF0YSA9IHtcbiAgICAgIHF1ZXJ5OiB7XG4gICAgICAgIGFuZHM6IFtdXG4gICAgICB9LFxuICAgICAgcGFnaW5hdGlvbjoge1xuICAgICAgICBwYWdlOiBvcHRpb25zLnBhZ2UsXG4gICAgICAgIHBlcl9wYWdlOiBvcHRpb25zLnBlclBhZ2VcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHF1ZXJpZXMpKSB7XG4gICAgICBxdWVyaWVzID0gW3F1ZXJpZXNdO1xuICAgIH1cbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyaWVzLmZvckVhY2goZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmlucHV0KSB7XG4gICAgICAgICAgZm9ybWF0dGVkQW5kcyA9IGZvcm1hdHRlZEFuZHMuY29uY2F0KGZvcm1hdEltYWdlc1NlYXJjaChxdWVyeS5pbnB1dCkpO1xuICAgICAgICB9IGVsc2UgaWYgKHF1ZXJ5LmNvbmNlcHQpIHtcbiAgICAgICAgICBmb3JtYXR0ZWRBbmRzID0gZm9ybWF0dGVkQW5kcy5jb25jYXQoZm9ybWF0Q29uY2VwdHNTZWFyY2gocXVlcnkuY29uY2VwdCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRhdGEucXVlcnkuYW5kcyA9IGZvcm1hdHRlZEFuZHM7XG4gICAgfVxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucG9zdCh1cmwsIGRhdGEsIHtoZWFkZXJzfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICAgIGRhdGEucmF3RGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGlucHV0cyBzdGF0dXMgKG51bWJlciBvZiB1cGxvYWRlZCwgaW4gcHJvY2VzcyBvciBmYWlsZWQgaW5wdXRzKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0U3RhdHVzKCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtJTlBVVFNfU1RBVFVTX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtoZWFkZXJzfSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICAgIGRhdGEucmF3RGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbjtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dHM7XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Inputs.js","/")
},{"./Input":41,"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27}],43:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var ModelVersion = require('./ModelVersion');

var _require = require('./helpers'),
    isSuccess = _require.isSuccess,
    checkType = _require.checkType,
    clone = _require.clone;

var _require2 = require('./constants'),
    API = _require2.API,
    SYNC_TIMEOUT = _require2.SYNC_TIMEOUT,
    replaceVars = _require2.replaceVars,
    STATUS = _require2.STATUS,
    POLLTIME = _require2.POLLTIME;

var MODEL_QUEUED_FOR_TRAINING = STATUS.MODEL_QUEUED_FOR_TRAINING,
    MODEL_TRAINING = STATUS.MODEL_TRAINING;

var _require3 = require('./utils'),
    wrapToken = _require3.wrapToken,
    formatMediaPredict = _require3.formatMediaPredict,
    formatModel = _require3.formatModel,
    formatObjectForSnakeCase = _require3.formatObjectForSnakeCase;

var MODEL_VERSIONS_PATH = API.MODEL_VERSIONS_PATH,
    MODEL_VERSION_PATH = API.MODEL_VERSION_PATH,
    MODELS_PATH = API.MODELS_PATH,
    MODEL_FEEDBACK_PATH = API.MODEL_FEEDBACK_PATH,
    MODEL_VERSION_FEEDBACK_PATH = API.MODEL_VERSION_FEEDBACK_PATH,
    PREDICT_PATH = API.PREDICT_PATH,
    VERSION_PREDICT_PATH = API.VERSION_PREDICT_PATH,
    MODEL_INPUTS_PATH = API.MODEL_INPUTS_PATH,
    MODEL_OUTPUT_PATH = API.MODEL_OUTPUT_PATH,
    MODEL_VERSION_INPUTS_PATH = API.MODEL_VERSION_INPUTS_PATH,
    MODEL_VERSION_METRICS_PATH = API.MODEL_VERSION_METRICS_PATH;

/**
 * class representing a model
 * @class
 */

var Model = function () {
  function Model(_config, data) {
    _classCallCheck(this, Model);

    this._config = _config;
    this.name = data.name;
    this.id = data.id;
    this.createdAt = data.created_at || data.createdAt;
    this.appId = data.app_id || data.appId;
    this.outputInfo = data.output_info || data.outputInfo;
    if (checkType(/(String)/, data.version)) {
      this.modelVersion = {};
      this.versionId = data.version;
    } else {
      if (data.model_version || data.modelVersion || data.version) {
        this.modelVersion = new ModelVersion(this._config, data.model_version || data.modelVersion || data.version);
      }
      this.versionId = (this.modelVersion || {}).id;
    }
    this.rawData = data;
  }

  /**
   * Merge concepts to a model
   * @param {object[]}      concepts    List of concept objects with id
   * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
   */


  _createClass(Model, [{
    key: 'mergeConcepts',
    value: function mergeConcepts() {
      var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
      return this.update({ action: 'merge', concepts: conceptsArr });
    }

    /**
     * Remove concepts from a model
     * @param {object[]}      concepts    List of concept objects with id
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'deleteConcepts',
    value: function deleteConcepts() {
      var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
      return this.update({ action: 'remove', concepts: conceptsArr });
    }

    /**
     * Overwrite concepts in a model
     * @param {object[]}      concepts    List of concept objects with id
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'overwriteConcepts',
    value: function overwriteConcepts() {
      var concepts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      var conceptsArr = Array.isArray(concepts) ? concepts : [concepts];
      return this.update({ action: 'overwrite', concepts: conceptsArr });
    }

    /**
     * Start a model evaluation job
     * @return {Promise(ModelVersion, error)} A Promise that is fulfilled with a ModelVersion instance or rejected with an error
     */

  }, {
    key: 'runModelEval',
    value: function runModelEval() {
      var _this = this;

      var url = '' + this._config.basePath + replaceVars(MODEL_VERSION_METRICS_PATH, [this.id, this.versionId]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, {}, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new ModelVersion(_this._config, response.data.model_version));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Update a model's output config or concepts
     * @param {object}               model                                 An object with any of the following attrs:
     *   @param {string}               name                                  The new name of the model to update with
     *   @param {boolean}              conceptsMutuallyExclusive             Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
     *   @param {boolean}              closedEnvironment                     Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
     *   @param {object[]}             concepts                              An array of concept objects or string
     *     @param {object|string}        concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
     *       @param {string}             concepts[].concept.id                   The id of the concept to attach to the model
     *   @param {object[]}             action                                The action to perform on the given concepts. Possible values are 'merge', 'remove', or 'overwrite'. Default: 'merge'
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'update',
    value: function update(obj) {
      var _this2 = this;

      var url = '' + this._config.basePath + MODELS_PATH;
      var modelData = [obj];
      var data = { models: modelData.map(function (m) {
          return formatModel(Object.assign(m, { id: _this2.id }));
        }) };
      if (Array.isArray(obj.concepts)) {
        data['action'] = obj.action || 'merge';
      }

      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.patch(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Model(_this2._config, response.data.models[0]));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Create a new model version
     * @param {boolean}       sync     If true, this returns after model has completely trained. If false, this immediately returns default api response.
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'train',
    value: function train(sync) {
      var _this3 = this;

      var url = '' + this._config.basePath + replaceVars(MODEL_VERSIONS_PATH, [this.id]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, null, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              if (sync) {
                var timeStart = Date.now();
                _this3._pollTrain.bind(_this3)(timeStart, resolve, reject);
              } else {
                resolve(new Model(_this3._config, response.data.model));
              }
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }, {
    key: '_pollTrain',
    value: function _pollTrain(timeStart, resolve, reject) {
      var _this4 = this;

      clearTimeout(this.pollTimeout);
      if (Date.now() - timeStart >= SYNC_TIMEOUT) {
        return reject({
          status: 'Error',
          message: 'Sync call timed out'
        });
      }
      this.getOutputInfo().then(function (model) {
        var modelStatusCode = model.modelVersion.status.code.toString();
        if (modelStatusCode === MODEL_QUEUED_FOR_TRAINING || modelStatusCode === MODEL_TRAINING) {
          _this4.pollTimeout = setTimeout(function () {
            return _this4._pollTrain(timeStart, resolve, reject);
          }, POLLTIME);
        } else {
          resolve(model);
        }
      }, reject).catch(reject);
    }

    /**
     * Returns model ouputs according to inputs
     * @param {object[]|object|string}       inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
     *    @param {object}                      inputs[].image     Object with keys explained below:
     *       @param {string}                     inputs[].image.(url|base64)   Can be a publicly accessibly url or base64 string representing image bytes (required)
     *       @param {number[]}                   inputs[].image.crop           An array containing the percent to be cropped from top, left, bottom and right (optional)
     * @param {object|string} config An object with keys explained below. If a string is passed instead, it will be treated as the language (backwards compatibility)
     *   @param {string} config.language A string code representing the language to return results in (example: 'zh' for simplified Chinese, 'ru' for Russian, 'ja' for Japanese)
     *   @param {boolean} config.video indicates if the input should be processed as a video
     *   @param {object[]} config.selectConcepts An array of concepts to return. Each object in the array will have a form of {name: <CONCEPT_NAME>} or {id: CONCEPT_ID}
     *   @param {float} config.minValue The minimum confidence threshold that a result must meet. From 0.0 to 1.0
     *   @param {number} config.maxConcepts The maximum number of concepts to return
     * @param {boolean} isVideo  Deprecated: indicates if the input should be processed as a video (default false). Deprecated in favor of using config object
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'predict',
    value: function predict(inputs) {
      var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var isVideo = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      if (checkType(/String/, config)) {
        console.warn('passing the language as a string is deprecated, consider using the configuration object instead');
        config = {
          language: config
        };
      }

      if (isVideo) {
        console.warn('"isVideo" argument is deprecated, consider using the configuration object instead');
        config.video = isVideo;
      }
      var video = config.video || false;
      delete config.video;
      if (checkType(/(Object|String)/, inputs)) {
        inputs = [inputs];
      }
      var url = '' + this._config.basePath + (this.versionId ? replaceVars(VERSION_PREDICT_PATH, [this.id, this.versionId]) : replaceVars(PREDICT_PATH, [this.id]));
      return wrapToken(this._config, function (headers) {
        var params = { inputs: inputs.map(function (input) {
            return formatMediaPredict(input, video ? 'video' : 'image');
          }) };
        if (config && Object.getOwnPropertyNames(config).length > 0) {
          params['model'] = {
            output_info: {
              output_config: formatObjectForSnakeCase(config)
            }
          };
        }
        return new Promise(function (resolve, reject) {
          axios.post(url, params, { headers: headers }).then(function (response) {
            var data = clone(response.data);
            data.rawData = clone(response.data);
            resolve(data);
          }, reject);
        });
      });
    }

    /**
     * Returns a version of the model specified by its id
     * @param {string}     versionId   The model's id
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getVersion',
    value: function getVersion(versionId) {
      var url = '' + this._config.basePath + replaceVars(MODEL_VERSION_PATH, [this.id, versionId]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            var data = clone(response.data);
            data.rawData = clone(response.data);
            resolve(data);
          }, reject);
        });
      });
    }

    /**
     * Returns a list of versions of the model
     * @param {object}     options     Object with keys explained below: (optional)
     *   @param {number}     options.page        The page number (optional, default: 1)
     *   @param {number}     options.perPage     Number of images to return per page (optional, default: 20)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getVersions',
    value: function getVersions() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + replaceVars(MODEL_VERSIONS_PATH, [this.id]);
      return wrapToken(this._config, function (headers) {
        var data = {
          headers: headers,
          params: { 'per_page': options.perPage, 'page': options.page }
        };
        return new Promise(function (resolve, reject) {
          axios.get(url, data).then(function (response) {
            var data = clone(response.data);
            data.rawData = clone(response.data);
            resolve(data);
          }, reject);
        });
      });
    }

    /**
     * Returns all the model's output info
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'getOutputInfo',
    value: function getOutputInfo() {
      var _this5 = this;

      var url = '' + this._config.basePath + replaceVars(MODEL_OUTPUT_PATH, [this.id]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            resolve(new Model(_this5._config, response.data.model));
          }, reject);
        });
      });
    }

    /**
     * Returns all the model's inputs
     * @param {object}     options     Object with keys explained below: (optional)
     *   @param {number}     options.page        The page number (optional, default: 1)
     *   @param {number}     options.perPage     Number of images to return per page (optional, default: 20)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getInputs',
    value: function getInputs() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + (this.versionId ? replaceVars(MODEL_VERSION_INPUTS_PATH, [this.id, this.versionId]) : replaceVars(MODEL_INPUTS_PATH, [this.id]));
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, {
            params: { 'per_page': options.perPage, 'page': options.page },
            headers: headers
          }).then(function (response) {
            var data = clone(response.data);
            data.rawData = clone(response.data);
            resolve(data);
          }, reject);
        });
      });
    }

    /**
     *
     * @param {string} input A string pointing to an image resource. A string must be a url
     * @param {object} config A configuration object consisting of the following required keys
     *   @param {string} config.id The id of the feedback request
     *   @param {object} config.data The feedback data to be sent
     *   @param {object} config.info Meta data related to the feedback request
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'feedback',
    value: function feedback(input, _ref) {
      var id = _ref.id,
          data = _ref.data,
          info = _ref.info;

      var url = '' + this._config.basePath + (this.versionId ? replaceVars(MODEL_VERSION_FEEDBACK_PATH, [this.id, this.versionId]) : replaceVars(MODEL_FEEDBACK_PATH, [this.id]));
      var media = formatMediaPredict(input).data;
      info.eventType = 'annotation';
      var body = {
        input: {
          id: id,
          data: Object.assign(media, data),
          'feedback_info': formatObjectForSnakeCase(info)
        }
      };
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, body, {
            headers: headers
          }).then(function (_ref2) {
            var data = _ref2.data;

            var d = clone(data);
            d.rawData = clone(data);
            resolve(d);
          }, reject);
        });
      });
    }
  }]);

  return Model;
}();

module.exports = Model;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVsLmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIk1vZGVsVmVyc2lvbiIsImlzU3VjY2VzcyIsImNoZWNrVHlwZSIsImNsb25lIiwiQVBJIiwiU1lOQ19USU1FT1VUIiwicmVwbGFjZVZhcnMiLCJTVEFUVVMiLCJQT0xMVElNRSIsIk1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkciLCJNT0RFTF9UUkFJTklORyIsIndyYXBUb2tlbiIsImZvcm1hdE1lZGlhUHJlZGljdCIsImZvcm1hdE1vZGVsIiwiZm9ybWF0T2JqZWN0Rm9yU25ha2VDYXNlIiwiTU9ERUxfVkVSU0lPTlNfUEFUSCIsIk1PREVMX1ZFUlNJT05fUEFUSCIsIk1PREVMU19QQVRIIiwiTU9ERUxfRkVFREJBQ0tfUEFUSCIsIk1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSCIsIlBSRURJQ1RfUEFUSCIsIlZFUlNJT05fUFJFRElDVF9QQVRIIiwiTU9ERUxfSU5QVVRTX1BBVEgiLCJNT0RFTF9PVVRQVVRfUEFUSCIsIk1PREVMX1ZFUlNJT05fSU5QVVRTX1BBVEgiLCJNT0RFTF9WRVJTSU9OX01FVFJJQ1NfUEFUSCIsIk1vZGVsIiwiX2NvbmZpZyIsImRhdGEiLCJuYW1lIiwiaWQiLCJjcmVhdGVkQXQiLCJjcmVhdGVkX2F0IiwiYXBwSWQiLCJhcHBfaWQiLCJvdXRwdXRJbmZvIiwib3V0cHV0X2luZm8iLCJ2ZXJzaW9uIiwibW9kZWxWZXJzaW9uIiwidmVyc2lvbklkIiwibW9kZWxfdmVyc2lvbiIsInJhd0RhdGEiLCJjb25jZXB0cyIsImNvbmNlcHRzQXJyIiwiQXJyYXkiLCJpc0FycmF5IiwidXBkYXRlIiwiYWN0aW9uIiwidXJsIiwiYmFzZVBhdGgiLCJoZWFkZXJzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJwb3N0IiwidGhlbiIsInJlc3BvbnNlIiwib2JqIiwibW9kZWxEYXRhIiwibW9kZWxzIiwibWFwIiwiT2JqZWN0IiwiYXNzaWduIiwibSIsInBhdGNoIiwic3luYyIsInRpbWVTdGFydCIsIkRhdGUiLCJub3ciLCJfcG9sbFRyYWluIiwiYmluZCIsIm1vZGVsIiwiY2xlYXJUaW1lb3V0IiwicG9sbFRpbWVvdXQiLCJzdGF0dXMiLCJtZXNzYWdlIiwiZ2V0T3V0cHV0SW5mbyIsIm1vZGVsU3RhdHVzQ29kZSIsImNvZGUiLCJ0b1N0cmluZyIsInNldFRpbWVvdXQiLCJjYXRjaCIsImlucHV0cyIsImNvbmZpZyIsImlzVmlkZW8iLCJjb25zb2xlIiwid2FybiIsImxhbmd1YWdlIiwidmlkZW8iLCJwYXJhbXMiLCJpbnB1dCIsImdldE93blByb3BlcnR5TmFtZXMiLCJsZW5ndGgiLCJvdXRwdXRfY29uZmlnIiwiZ2V0Iiwib3B0aW9ucyIsInBhZ2UiLCJwZXJQYWdlIiwiaW5mbyIsIm1lZGlhIiwiZXZlbnRUeXBlIiwiYm9keSIsImQiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQUlDLGVBQWVELFFBQVEsZ0JBQVIsQ0FBbkI7O2VBQ29DQSxRQUFRLFdBQVIsQztJQUEvQkUsUyxZQUFBQSxTO0lBQVdDLFMsWUFBQUEsUztJQUFXQyxLLFlBQUFBLEs7O2dCQU92QkosUUFBUSxhQUFSLEM7SUFMRkssRyxhQUFBQSxHO0lBQ0FDLFksYUFBQUEsWTtJQUNBQyxXLGFBQUFBLFc7SUFDQUMsTSxhQUFBQSxNO0lBQ0FDLFEsYUFBQUEsUTs7SUFFR0MseUIsR0FBNkNGLE0sQ0FBN0NFLHlCO0lBQTJCQyxjLEdBQWtCSCxNLENBQWxCRyxjOztnQkFDNkNYLFFBQVEsU0FBUixDO0lBQXhFWSxTLGFBQUFBLFM7SUFBV0Msa0IsYUFBQUEsa0I7SUFBb0JDLFcsYUFBQUEsVztJQUFhQyx3QixhQUFBQSx3Qjs7SUFFL0NDLG1CLEdBV0VYLEcsQ0FYRlcsbUI7SUFDQUMsa0IsR0FVRVosRyxDQVZGWSxrQjtJQUNBQyxXLEdBU0ViLEcsQ0FURmEsVztJQUNBQyxtQixHQVFFZCxHLENB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bUJBQVosRUFBaUMsQ0FBQyxLQUFLWSxFQUFOLENBQWpDLENBRkksQ0FBTjtBQUdBLFVBQU1xRSxRQUFRdkYsbUJBQW1COEUsS0FBbkIsRUFBMEI5RCxJQUF4QztBQUNBc0UsV0FBS0UsU0FBTCxHQUFpQixZQUFqQjtBQUNBLFVBQU1DLE9BQU87QUFDWFgsZUFBTztBQUNMNUQsZ0JBREs7QUFFTEYsZ0JBQU1pQyxPQUFPQyxNQUFQLENBQWNxQyxLQUFkLEVBQXFCdkUsSUFBckIsQ0FGRDtBQUdMLDJCQUFpQmQseUJBQXlCb0YsSUFBekI7QUFIWjtBQURJLE9BQWI7QUFPQSxhQUFPdkYsVUFBVSxLQUFLZ0IsT0FBZixFQUF3QixtQkFBVztBQUN4QyxlQUFPLElBQUl3QixPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDdkQsZ0JBQU13RCxJQUFOLENBQVdOLEdBQVgsRUFBZ0JxRCxJQUFoQixFQUFzQjtBQUNwQm5EO0FBRG9CLFdBQXRCLEVBRUdLLElBRkgsQ0FFUSxpQkFBWTtBQUFBLGdCQUFWM0IsSUFBVSxTQUFWQSxJQUFVOztBQUNsQixnQkFBTTBFLElBQUluRyxNQUFNeUIsSUFBTixDQUFWO0FBQ0EwRSxjQUFFN0QsT0FBRixHQUFZdEMsTUFBTXlCLElBQU4sQ0FBWjtBQUNBd0Isb0JBQVFrRCxDQUFSO0FBQ0QsV0FORCxFQU1HakQsTUFOSDtBQU9ELFNBUk0sQ0FBUDtBQVNELE9BVk0sQ0FBUDtBQVdEOzs7Ozs7QUFHSGtELE9BQ0dDLE9BREgsR0FDYTlFLEtBRGIiLCJmaWxlIjoiTW9kZWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IE1vZGVsVmVyc2lvbiA9IHJlcXVpcmUoJy4vTW9kZWxWZXJzaW9uJyk7XG5sZXQge2lzU3VjY2VzcywgY2hlY2tUeXBlLCBjbG9uZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcbmxldCB7XG4gIEFQSSxcbiAgU1lOQ19USU1FT1VULFxuICByZXBsYWNlVmFycyxcbiAgU1RBVFVTLFxuICBQT0xMVElNRVxufSA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XG5sZXQge01PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkcsIE1PREVMX1RSQUlOSU5HfSA9IFNUQVRVUztcbmxldCB7d3JhcFRva2VuLCBmb3JtYXRNZWRpYVByZWRpY3QsIGZvcm1hdE1vZGVsLCBmb3JtYXRPYmplY3RGb3JTbmFrZUNhc2V9ID0gcmVxdWlyZSgnLi91dGlscycpO1xubGV0IHtcbiAgTU9ERUxfVkVSU0lPTlNfUEFUSCxcbiAgTU9ERUxfVkVSU0lPTl9QQVRILFxuICBNT0RFTFNfUEFUSCxcbiAgTU9ERUxfRkVFREJBQ0tfUEFUSCxcbiAgTU9ERUxfVkVSU0lPTl9GRUVEQkFDS19QQVRILFxuICBQUkVESUNUX1BBVEgsXG4gIFZFUlNJT05fUFJFRElDVF9QQVRILFxuICBNT0RFTF9JTlBVVFNfUEFUSCxcbiAgTU9ERUxfT1VUUFVUX1BBVEgsXG4gIE1PREVMX1ZFUlNJT05fSU5QVVRTX1BBVEgsXG4gIE1PREVMX1ZFUlNJT05fTUVUUklDU19QQVRIXG59ID0gQVBJO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIG1vZGVsXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgTW9kZWwge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLm5hbWUgPSBkYXRhLm5hbWU7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5jcmVhdGVkQXQgPSBkYXRhLmNyZWF0ZWRfYXQgfHwgZGF0YS5jcmVhdGVkQXQ7XG4gICAgdGhpcy5hcHBJZCA9IGRhdGEuYXBwX2lkIHx8IGRhdGEuYXBwSWQ7XG4gICAgdGhpcy5vdXRwdXRJbmZvID0gZGF0YS5vdXRwdXRfaW5mbyB8fCBkYXRhLm91dHB1dEluZm87XG4gICAgaWYgKGNoZWNrVHlwZSgvKFN0cmluZykvLCBkYXRhLnZlcnNpb24pKSB7XG4gICAgICB0aGlzLm1vZGVsVmVyc2lvbiA9IHt9O1xuICAgICAgdGhpcy52ZXJzaW9uSWQgPSBkYXRhLnZlcnNpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChkYXRhLm1vZGVsX3ZlcnNpb24gfHwgZGF0YS5tb2RlbFZlcnNpb24gfHwgZGF0YS52ZXJzaW9uKSB7XG4gICAgICAgIHRoaXMubW9kZWxWZXJzaW9uID0gbmV3IE1vZGVsVmVyc2lvbih0aGlzLl9jb25maWcsIGRhdGEubW9kZWxfdmVyc2lvbiB8fCBkYXRhLm1vZGVsVmVyc2lvbiB8fCBkYXRhLnZlcnNpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy52ZXJzaW9uSWQgPSAodGhpcy5tb2RlbFZlcnNpb24gfHwge30pLmlkO1xuICAgIH1cbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlIGNvbmNlcHRzIHRvIGEgbW9kZWxcbiAgICogQHBhcmFtIHtvYmplY3RbXX0gICAgICBjb25jZXB0cyAgICBMaXN0IG9mIGNvbmNlcHQgb2JqZWN0cyB3aXRoIGlkXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBtZXJnZUNvbmNlcHRzKGNvbmNlcHRzID0gW10pIHtcbiAgICBsZXQgY29uY2VwdHNBcnIgPSBBcnJheS5pc0FycmF5KGNvbmNlcHRzKSA/IGNvbmNlcHRzIDogW2NvbmNlcHRzXTtcbiAgICByZXR1cm4gdGhpcy51cGRhdGUoe2FjdGlvbjogJ21lcmdlJywgY29uY2VwdHM6IGNvbmNlcHRzQXJyfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGNvbmNlcHRzIGZyb20gYSBtb2RlbFxuICAgKiBAcGFyYW0ge29iamVjdFtdfSAgICAgIGNvbmNlcHRzICAgIExpc3Qgb2YgY29uY2VwdCBvYmplY3RzIHdpdGggaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShNb2RlbCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhIE1vZGVsIGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGRlbGV0ZUNvbmNlcHRzKGNvbmNlcHRzID0gW10pIHtcbiAgICBsZXQgY29uY2VwdHNBcnIgPSBBcnJheS5pc0FycmF5KGNvbmNlcHRzKSA/IGNvbmNlcHRzIDogW2NvbmNlcHRzXTtcbiAgICByZXR1cm4gdGhpcy51cGRhdGUoe2FjdGlvbjogJ3JlbW92ZScsIGNvbmNlcHRzOiBjb25jZXB0c0Fycn0pO1xuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0ZSBjb25jZXB0cyBpbiBhIG1vZGVsXG4gICAqIEBwYXJhbSB7b2JqZWN0W119ICAgICAgY29uY2VwdHMgICAgTGlzdCBvZiBjb25jZXB0IG9iamVjdHMgd2l0aCBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWwgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgb3ZlcndyaXRlQ29uY2VwdHMoY29uY2VwdHMgPSBbXSkge1xuICAgIGxldCBjb25jZXB0c0FyciA9IEFycmF5LmlzQXJyYXkoY29uY2VwdHMpID8gY29uY2VwdHMgOiBbY29uY2VwdHNdO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZSh7YWN0aW9uOiAnb3ZlcndyaXRlJywgY29uY2VwdHM6IGNvbmNlcHRzQXJyfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgYSBtb2RlbCBldmFsdWF0aW9uIGpvYlxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsVmVyc2lvbiwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhIE1vZGVsVmVyc2lvbiBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBydW5Nb2RlbEV2YWwoKSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKE1PREVMX1ZFUlNJT05fTUVUUklDU19QQVRILCBbdGhpcy5pZCwgdGhpcy52ZXJzaW9uSWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucG9zdCh1cmwsIHt9LCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVsVmVyc2lvbih0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWxfdmVyc2lvbikpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhIG1vZGVsJ3Mgb3V0cHV0IGNvbmZpZyBvciBjb25jZXB0c1xuICAgKiBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICBtb2RlbCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFuIG9iamVjdCB3aXRoIGFueSBvZiB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIG5ldyBuYW1lIG9mIHRoZSBtb2RlbCB0byB1cGRhdGUgd2l0aFxuICAgKiAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgIGNvbmNlcHRzTXV0dWFsbHlFeGNsdXNpdmUgICAgICAgICAgICAgRG8geW91IGV4cGVjdCB0byBzZWUgbW9yZSB0aGFuIG9uZSBvZiB0aGUgY29uY2VwdHMgaW4gdGhpcyBtb2RlbCBpbiB0aGUgU0FNRSBpbWFnZT8gU2V0IHRvIGZhbHNlIChkZWZhdWx0KSBpZiBzby4gT3RoZXJ3aXNlLCBzZXQgdG8gdHJ1ZS5cbiAgICogICBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICBjbG9zZWRFbnZpcm9ubWVudCAgICAgICAgICAgICAgICAgICAgIERvIHlvdSBleHBlY3QgdG8gcnVuIHRoZSB0cmFpbmVkIG1vZGVsIG9uIGltYWdlcyB0aGF0IGRvIG5vdCBjb250YWluIEFOWSBvZiB0aGUgY29uY2VwdHMgaW4gdGhlIG1vZGVsPyBTZXQgdG8gZmFsc2UgKGRlZmF1bHQpIGlmIHNvLiBPdGhlcndpc2UsIHNldCB0byB0cnVlLlxuICAgKiAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgIGNvbmNlcHRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgb2YgY29uY2VwdCBvYmplY3RzIG9yIHN0cmluZ1xuICAgKiAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0ICAgICAgICAgICAgICAgICAgICBJZiBzdHJpbmcgaXMgZ2l2ZW4sIHRoaXMgaXMgaW50ZXJwcmV0ZWQgYXMgY29uY2VwdCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGNsaWVudCBleHBlY3RzIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlc1xuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgICAgICAgICAgICAgIFRoZSBpZCBvZiB0aGUgY29uY2VwdCB0byBhdHRhY2ggdG8gdGhlIG1vZGVsXG4gICAqICAgQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICAgICAgYWN0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgYWN0aW9uIHRvIHBlcmZvcm0gb24gdGhlIGdpdmVuIGNvbmNlcHRzLiBQb3NzaWJsZSB2YWx1ZXMgYXJlICdtZXJnZScsICdyZW1vdmUnLCBvciAnb3ZlcndyaXRlJy4gRGVmYXVsdDogJ21lcmdlJ1xuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWwgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgdXBkYXRlKG9iaikge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtNT0RFTFNfUEFUSH1gO1xuICAgIGxldCBtb2RlbERhdGEgPSBbb2JqXTtcbiAgICBsZXQgZGF0YSA9IHttb2RlbHM6IG1vZGVsRGF0YS5tYXAobSA9PiBmb3JtYXRNb2RlbChPYmplY3QuYXNzaWduKG0sIHtpZDogdGhpcy5pZH0pKSl9O1xuICAgIGlmIChBcnJheS5pc0FycmF5KG9iai5jb25jZXB0cykpIHtcbiAgICAgIGRhdGFbJ2FjdGlvbiddID0gb2JqLmFjdGlvbiB8fCAnbWVyZ2UnO1xuICAgIH1cblxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbHNbMF0pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbW9kZWwgdmVyc2lvblxuICAgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgIHN5bmMgICAgIElmIHRydWUsIHRoaXMgcmV0dXJucyBhZnRlciBtb2RlbCBoYXMgY29tcGxldGVseSB0cmFpbmVkLiBJZiBmYWxzZSwgdGhpcyBpbW1lZGlhdGVseSByZXR1cm5zIGRlZmF1bHQgYXBpIHJlc3BvbnNlLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGEgTW9kZWwgaW5zdGFuY2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgdHJhaW4oc3luYykge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9WRVJTSU9OU19QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgbnVsbCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICBpZiAoc3luYykge1xuICAgICAgICAgICAgICBsZXQgdGltZVN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgdGhpcy5fcG9sbFRyYWluLmJpbmQodGhpcykodGltZVN0YXJ0LCByZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWwodGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLm1vZGVsKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBfcG9sbFRyYWluKHRpbWVTdGFydCwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucG9sbFRpbWVvdXQpO1xuICAgIGlmICgoRGF0ZS5ub3coKSAtIHRpbWVTdGFydCkgPj0gU1lOQ19USU1FT1VUKSB7XG4gICAgICByZXR1cm4gcmVqZWN0KHtcbiAgICAgICAgc3RhdHVzOiAnRXJyb3InLFxuICAgICAgICBtZXNzYWdlOiAnU3luYyBjYWxsIHRpbWVkIG91dCdcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLmdldE91dHB1dEluZm8oKS50aGVuKChtb2RlbCkgPT4ge1xuICAgICAgbGV0IG1vZGVsU3RhdHVzQ29kZSA9IG1vZGVsLm1vZGVsVmVyc2lvbi5zdGF0dXMuY29kZS50b1N0cmluZygpO1xuICAgICAgaWYgKG1vZGVsU3RhdHVzQ29kZSA9PT0gTU9ERUxfUVVFVUVEX0ZPUl9UUkFJTklORyB8fCBtb2RlbFN0YXR1c0NvZGUgPT09IE1PREVMX1RSQUlOSU5HKSB7XG4gICAgICAgIHRoaXMucG9sbFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3BvbGxUcmFpbih0aW1lU3RhcnQsIHJlc29sdmUsIHJlamVjdCksIFBPTExUSU1FKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUobW9kZWwpO1xuICAgICAgfVxuICAgIH0sIHJlamVjdClcbiAgICAgIC5jYXRjaChyZWplY3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgbW9kZWwgb3VwdXRzIGFjY29yZGluZyB0byBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3RbXXxvYmplY3R8c3RyaW5nfSAgICAgICBpbnB1dHMgICAgQW4gYXJyYXkgb2Ygb2JqZWN0cy9vYmplY3Qvc3RyaW5nIHBvaW50aW5nIHRvIGFuIGltYWdlIHJlc291cmNlLiBBIHN0cmluZyBjYW4gZWl0aGVyIGJlIGEgdXJsIG9yIGJhc2U2NCBpbWFnZSBieXRlcy4gT2JqZWN0IGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbWFnZS4odXJsfGJhc2U2NCkgICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqICAgICAgIEBwYXJhbSB7bnVtYmVyW119ICAgICAgICAgICAgICAgICAgIGlucHV0c1tdLmltYWdlLmNyb3AgICAgICAgICAgIEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHBlcmNlbnQgdG8gYmUgY3JvcHBlZCBmcm9tIHRvcCwgbGVmdCwgYm90dG9tIGFuZCByaWdodCAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gY29uZmlnIEFuIG9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93LiBJZiBhIHN0cmluZyBpcyBwYXNzZWQgaW5zdGVhZCwgaXQgd2lsbCBiZSB0cmVhdGVkIGFzIHRoZSBsYW5ndWFnZSAoYmFja3dhcmRzIGNvbXBhdGliaWxpdHkpXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5sYW5ndWFnZSBBIHN0cmluZyBjb2RlIHJlcHJlc2VudGluZyB0aGUgbGFuZ3VhZ2UgdG8gcmV0dXJuIHJlc3VsdHMgaW4gKGV4YW1wbGU6ICd6aCcgZm9yIHNpbXBsaWZpZWQgQ2hpbmVzZSwgJ3J1JyBmb3IgUnVzc2lhbiwgJ2phJyBmb3IgSmFwYW5lc2UpXG4gICAqICAgQHBhcmFtIHtib29sZWFufSBjb25maWcudmlkZW8gaW5kaWNhdGVzIGlmIHRoZSBpbnB1dCBzaG91bGQgYmUgcHJvY2Vzc2VkIGFzIGEgdmlkZW9cbiAgICogICBAcGFyYW0ge29iamVjdFtdfSBjb25maWcuc2VsZWN0Q29uY2VwdHMgQW4gYXJyYXkgb2YgY29uY2VwdHMgdG8gcmV0dXJuLiBFYWNoIG9iamVjdCBpbiB0aGUgYXJyYXkgd2lsbCBoYXZlIGEgZm9ybSBvZiB7bmFtZTogPENPTkNFUFRfTkFNRT59IG9yIHtpZDogQ09OQ0VQVF9JRH1cbiAgICogICBAcGFyYW0ge2Zsb2F0fSBjb25maWcubWluVmFsdWUgVGhlIG1pbmltdW0gY29uZmlkZW5jZSB0aHJlc2hvbGQgdGhhdCBhIHJlc3VsdCBtdXN0IG1lZXQuIEZyb20gMC4wIHRvIDEuMFxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSBjb25maWcubWF4Q29uY2VwdHMgVGhlIG1heGltdW0gbnVtYmVyIG9mIGNvbmNlcHRzIHRvIHJldHVyblxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzVmlkZW8gIERlcHJlY2F0ZWQ6IGluZGljYXRlcyBpZiB0aGUgaW5wdXQgc2hvdWxkIGJlIHByb2Nlc3NlZCBhcyBhIHZpZGVvIChkZWZhdWx0IGZhbHNlKS4gRGVwcmVjYXRlZCBpbiBmYXZvciBvZiB1c2luZyBjb25maWcgb2JqZWN0XG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBwcmVkaWN0KGlucHV0cywgY29uZmlnID0ge30sIGlzVmlkZW8gPSBmYWxzZSkge1xuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGNvbmZpZykpIHtcbiAgICAgIGNvbnNvbGUud2FybigncGFzc2luZyB0aGUgbGFuZ3VhZ2UgYXMgYSBzdHJpbmcgaXMgZGVwcmVjYXRlZCwgY29uc2lkZXIgdXNpbmcgdGhlIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGluc3RlYWQnKTtcbiAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgbGFuZ3VhZ2U6IGNvbmZpZ1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoaXNWaWRlbykge1xuICAgICAgY29uc29sZS53YXJuKCdcImlzVmlkZW9cIiBhcmd1bWVudCBpcyBkZXByZWNhdGVkLCBjb25zaWRlciB1c2luZyB0aGUgY29uZmlndXJhdGlvbiBvYmplY3QgaW5zdGVhZCcpO1xuICAgICAgY29uZmlnLnZpZGVvID0gaXNWaWRlbztcbiAgICB9XG4gICAgY29uc3QgdmlkZW8gPSBjb25maWcudmlkZW8gfHwgZmFsc2U7XG4gICAgZGVsZXRlIGNvbmZpZy52aWRlbztcbiAgICBpZiAoY2hlY2tUeXBlKC8oT2JqZWN0fFN0cmluZykvLCBpbnB1dHMpKSB7XG4gICAgICBpbnB1dHMgPSBbaW5wdXRzXTtcbiAgICB9XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3RoaXMudmVyc2lvbklkID9cbiAgICAgIHJlcGxhY2VWYXJzKFZFUlNJT05fUFJFRElDVF9QQVRILCBbdGhpcy5pZCwgdGhpcy52ZXJzaW9uSWRdKSA6XG4gICAgICByZXBsYWNlVmFycyhQUkVESUNUX1BBVEgsIFt0aGlzLmlkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGxldCBwYXJhbXMgPSB7aW5wdXRzOiBpbnB1dHMubWFwKGlucHV0ID0+IGZvcm1hdE1lZGlhUHJlZGljdChpbnB1dCwgdmlkZW8gPyAndmlkZW8nIDogJ2ltYWdlJykpfTtcbiAgICAgIGlmIChjb25maWcgJiYgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoY29uZmlnKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHBhcmFtc1snbW9kZWwnXSA9IHtcbiAgICAgICAgICBvdXRwdXRfaW5mbzoge1xuICAgICAgICAgICAgb3V0cHV0X2NvbmZpZzogZm9ybWF0T2JqZWN0Rm9yU25ha2VDYXNlKGNvbmZpZylcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgcGFyYW1zLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgbGV0IGRhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHZlcnNpb24gb2YgdGhlIG1vZGVsIHNwZWNpZmllZCBieSBpdHMgaWRcbiAgICogQHBhcmFtIHtzdHJpbmd9ICAgICB2ZXJzaW9uSWQgICBUaGUgbW9kZWwncyBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0VmVyc2lvbih2ZXJzaW9uSWQpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTl9QQVRILCBbdGhpcy5pZCwgdmVyc2lvbklkXSl9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgIGRhdGEucmF3RGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbGlzdCBvZiB2ZXJzaW9ucyBvZiB0aGUgbW9kZWxcbiAgICogQHBhcmFtIHtvYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0VmVyc2lvbnMob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoTU9ERUxfVkVSU0lPTlNfUEFUSCwgW3RoaXMuaWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IGRhdGEgPSB7XG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIHBhcmFtczogeydwZXJfcGFnZSc6IG9wdGlvbnMucGVyUGFnZSwgJ3BhZ2UnOiBvcHRpb25zLnBhZ2V9LFxuICAgICAgfTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIGRhdGEpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgbGV0IGRhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbGwgdGhlIG1vZGVsJ3Mgb3V0cHV0IGluZm9cbiAgICogQHJldHVybiB7UHJvbWlzZShNb2RlbCwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhIE1vZGVsIGluc3RhbmNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldE91dHB1dEluZm8oKSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKE1PREVMX09VVFBVVF9QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWwodGhpcy5fY29uZmlnLCByZXNwb25zZS5kYXRhLm1vZGVsKSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCB0aGUgbW9kZWwncyBpbnB1dHNcbiAgICogQHBhcmFtIHtvYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKHJlc3BvbnNlLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIHRoZSBBUEkgcmVzcG9uc2Ugb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgZ2V0SW5wdXRzKG9wdGlvbnMgPSB7cGFnZTogMSwgcGVyUGFnZTogMjB9KSB7XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3RoaXMudmVyc2lvbklkID9cbiAgICAgIHJlcGxhY2VWYXJzKE1PREVMX1ZFUlNJT05fSU5QVVRTX1BBVEgsIFt0aGlzLmlkLCB0aGlzLnZlcnNpb25JZF0pIDpcbiAgICAgIHJlcGxhY2VWYXJzKE1PREVMX0lOUFVUU19QQVRILCBbdGhpcy5pZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5nZXQodXJsLCB7XG4gICAgICAgICAgcGFyYW1zOiB7J3Blcl9wYWdlJzogb3B0aW9ucy5wZXJQYWdlLCAncGFnZSc6IG9wdGlvbnMucGFnZX0sXG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgZGF0YS5yYXdEYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBpbnB1dCBBIHN0cmluZyBwb2ludGluZyB0byBhbiBpbWFnZSByZXNvdXJjZS4gQSBzdHJpbmcgbXVzdCBiZSBhIHVybFxuICAgKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIEEgY29uZmlndXJhdGlvbiBvYmplY3QgY29uc2lzdGluZyBvZiB0aGUgZm9sbG93aW5nIHJlcXVpcmVkIGtleXNcbiAgICogICBAcGFyYW0ge3N0cmluZ30gY29uZmlnLmlkIFRoZSBpZCBvZiB0aGUgZmVlZGJhY2sgcmVxdWVzdFxuICAgKiAgIEBwYXJhbSB7b2JqZWN0fSBjb25maWcuZGF0YSBUaGUgZmVlZGJhY2sgZGF0YSB0byBiZSBzZW50XG4gICAqICAgQHBhcmFtIHtvYmplY3R9IGNvbmZpZy5pbmZvIE1ldGEgZGF0YSByZWxhdGVkIHRvIHRoZSBmZWVkYmFjayByZXF1ZXN0XG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBmZWVkYmFjayhpbnB1dCwge2lkLCBkYXRhLCBpbmZvfSkge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3RoaXMudmVyc2lvbklkID9cbiAgICAgIHJlcGxhY2VWYXJzKE1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSCwgW3RoaXMuaWQsIHRoaXMudmVyc2lvbklkXSkgOlxuICAgICAgcmVwbGFjZVZhcnMoTU9ERUxfRkVFREJBQ0tfUEFUSCwgW3RoaXMuaWRdKX1gO1xuICAgIGNvbnN0IG1lZGlhID0gZm9ybWF0TWVkaWFQcmVkaWN0KGlucHV0KS5kYXRhO1xuICAgIGluZm8uZXZlbnRUeXBlID0gJ2Fubm90YXRpb24nO1xuICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBpZCxcbiAgICAgICAgZGF0YTogT2JqZWN0LmFzc2lnbihtZWRpYSwgZGF0YSksXG4gICAgICAgICdmZWVkYmFja19pbmZvJzogZm9ybWF0T2JqZWN0Rm9yU25ha2VDYXNlKGluZm8pXG4gICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgaGVhZGVycyA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgYm9keSwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbigoe2RhdGF9KSA9PiB7XG4gICAgICAgICAgY29uc3QgZCA9IGNsb25lKGRhdGEpO1xuICAgICAgICAgIGQucmF3RGF0YSA9IGNsb25lKGRhdGEpO1xuICAgICAgICAgIHJlc29sdmUoZCk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGVcbiAgLmV4cG9ydHMgPSBNb2RlbDtcbiJdfQ==
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Model.js","/")
},{"./ModelVersion":44,"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27}],44:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * class representing a version of a model
 * @class
 */
var ModelVersion = function ModelVersion(_config, data) {
  _classCallCheck(this, ModelVersion);

  this.id = data.id;
  this.created_at = this.createdAt = data.created_at || data.createdAt;
  this.status = data.status;
  this.active_concept_count = data.active_concept_count;
  this.metrics = data.metrics;
  this._config = _config;
  this.rawData = data;
};

;

module.exports = ModelVersion;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVsVmVyc2lvbi5qcyJdLCJuYW1lcyI6WyJNb2RlbFZlcnNpb24iLCJfY29uZmlnIiwiZGF0YSIsImlkIiwiY3JlYXRlZF9hdCIsImNyZWF0ZWRBdCIsInN0YXR1cyIsImFjdGl2ZV9jb25jZXB0X2NvdW50IiwibWV0cmljcyIsInJhd0RhdGEiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7SUFJTUEsWSxHQUNKLHNCQUFZQyxPQUFaLEVBQXFCQyxJQUFyQixFQUEyQjtBQUFBOztBQUN6QixPQUFLQyxFQUFMLEdBQVVELEtBQUtDLEVBQWY7QUFDQSxPQUFLQyxVQUFMLEdBQWtCLEtBQUtDLFNBQUwsR0FBaUJILEtBQUtFLFVBQUwsSUFBbUJGLEtBQUtHLFNBQTNEO0FBQ0EsT0FBS0MsTUFBTCxHQUFjSixLQUFLSSxNQUFuQjtBQUNBLE9BQUtDLG9CQUFMLEdBQTRCTCxLQUFLSyxvQkFBakM7QUFDQSxPQUFLQyxPQUFMLEdBQWVOLEtBQUtNLE9BQXBCO0FBQ0EsT0FBS1AsT0FBTCxHQUFlQSxPQUFmO0FBQ0EsT0FBS1EsT0FBTCxHQUFlUCxJQUFmO0FBQ0QsQzs7QUFFSDs7QUFFQVEsT0FBT0MsT0FBUCxHQUFpQlgsWUFBakIiLCJmaWxlIjoiTW9kZWxWZXJzaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSB2ZXJzaW9uIG9mIGEgbW9kZWxcbiAqIEBjbGFzc1xuICovXG5jbGFzcyBNb2RlbFZlcnNpb24ge1xuICBjb25zdHJ1Y3RvcihfY29uZmlnLCBkYXRhKSB7XG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XG4gICAgdGhpcy5jcmVhdGVkX2F0ID0gdGhpcy5jcmVhdGVkQXQgPSBkYXRhLmNyZWF0ZWRfYXQgfHwgZGF0YS5jcmVhdGVkQXQ7XG4gICAgdGhpcy5zdGF0dXMgPSBkYXRhLnN0YXR1cztcbiAgICB0aGlzLmFjdGl2ZV9jb25jZXB0X2NvdW50ID0gZGF0YS5hY3RpdmVfY29uY2VwdF9jb3VudDtcbiAgICB0aGlzLm1ldHJpY3MgPSBkYXRhLm1ldHJpY3M7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSBkYXRhO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gTW9kZWxWZXJzaW9uO1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/ModelVersion.js","/")
},{"buffer":23,"pBGvAp":27}],45:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var Promise = require('promise');
var Model = require('./Model');
var Concepts = require('./Concepts');

var _require = require('./constants'),
    API = _require.API,
    ERRORS = _require.ERRORS,
    replaceVars = _require.replaceVars;

var _require2 = require('./helpers'),
    isSuccess = _require2.isSuccess,
    checkType = _require2.checkType,
    clone = _require2.clone;

var _require3 = require('./utils'),
    wrapToken = _require3.wrapToken,
    formatModel = _require3.formatModel;

var MODELS_PATH = API.MODELS_PATH,
    MODEL_PATH = API.MODEL_PATH,
    MODEL_SEARCH_PATH = API.MODEL_SEARCH_PATH,
    MODEL_VERSION_PATH = API.MODEL_VERSION_PATH;

/**
 * class representing a collection of models
 * @class
 */

var Models = function () {
  function Models(_config) {
    var _this = this;

    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Models);

    this._config = _config;
    this.rawData = rawData;
    rawData.forEach(function (modelData, index) {
      _this[index] = new Model(_this._config, modelData);
    });
    this.length = rawData.length;
  }

  /**
   * Returns a Model instance given model id or name. It will call search if name is given.
   * @param {string|object}    model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
   *   @param {string}           model.id          Model id
   *   @param {string}           model.name        Model name
   *   @param {string}           model.version     Model version
   *   @param {string}           model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
   * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
   */


  _createClass(Models, [{
    key: 'initModel',
    value: function initModel(model) {
      var _this2 = this;

      var data = {};
      var fn = void 0;
      if (checkType(/String/, model)) {
        data.id = model;
      } else {
        data = model;
      }
      if (data.id) {
        fn = function fn(resolve, reject) {
          resolve(new Model(_this2._config, data));
        };
      } else {
        fn = function fn(resolve, reject) {
          _this2.search(data.name, data.type).then(function (models) {
            if (data.version) {
              resolve(models.rawData.filter(function (model) {
                return model.modelVersion.id === data.version;
              }));
            } else {
              resolve(models[0]);
            }
          }, reject).catch(reject);
        };
      }
      return new Promise(fn);
    }

    /**
     * Calls predict given model info and inputs to predict on
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.language    Model language (only for Clarifai's public models)
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @param {object[]|object|string}   inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
     *    @param {object}                  inputs[].image     Object with keys explained below:
     *       @param {string}                 inputs[].image.(url|base64)  Can be a publicly accessibly url or base64 string representing image bytes (required)
     * @param {boolean} isVideo  indicates if the input should be processed as a video (default false)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'predict',
    value: function predict(model, inputs) {
      var _this3 = this;

      var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (checkType(/Boolean/, config)) {
        console.warn('"isVideo" argument is deprecated, consider using the configuration object instead');
        config = {
          video: config
        };
      }
      if (model.language) {
        config.language = model.language;
      }
      return new Promise(function (resolve, reject) {
        _this3.initModel(model).then(function (modelObj) {
          modelObj.predict(inputs, config).then(resolve, reject).catch(reject);
        }, reject);
      });
    }

    /**
     * Calls train on a model and creates a new model version given model info
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @param {boolean}                  sync        If true, this returns after model has completely trained. If false, this immediately returns default api response.
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'train',
    value: function train(model) {
      var _this4 = this;

      var sync = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      return new Promise(function (resolve, reject) {
        _this4.initModel(model).then(function (model) {
          model.train(sync).then(resolve, reject).catch(reject);
        }, reject);
      });
    }

    /**
     *
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @param {string} input A string pointing to an image resource. A string must be a url
     * @param {object} config A configuration object consisting of the following required keys
     *   @param {string} config.id The id of the feedback request
     *   @param {object} config.data The feedback data to be sent
     *   @param {object} config.info Meta data related to the feedback request
     */

  }, {
    key: 'feedback',
    value: function feedback(model, input, config) {
      var _this5 = this;

      return new Promise(function (resolve, reject) {
        _this5.initModel(model).then(function (model) {
          return model.feedback(input, config);
        }).then(function (d) {
          return resolve(d);
        }).catch(function (e) {
          return reject(e);
        });
      });
    }

    /**
     * Returns a version of the model specified by its id
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @param {string}     versionId   The model's id
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getVersion',
    value: function getVersion(model, versionId) {
      var _this6 = this;

      return new Promise(function (resolve, reject) {
        _this6.initModel(model).then(function (model) {
          model.getVersion(versionId).then(resolve, reject).catch(reject);
        }, reject);
      });
    }

    /**
     * Returns a list of versions of the model
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @param {object}                   options     Object with keys explained below: (optional)
     *   @param {number}                   options.page        The page number (optional, default: 1)
     *   @param {number}                   options.perPage     Number of images to return per page (optional, default: 20)
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'getVersions',
    value: function getVersions(model) {
      var _this7 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { page: 1, perPage: 20 };

      return new Promise(function (resolve, reject) {
        _this7.initModel(model).then(function (model) {
          model.getVersions(options).then(resolve, reject).catch(reject);
        }, reject);
      });
    }

    /**
     * Returns all the model's output info
     * @param {string|object}            model       If string, it is assumed to be model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                   model.id          Model id
     *   @param {string}                   model.name        Model name
     *   @param {string}                   model.version     Model version
     *   @param {string}                   model.type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @return {Promise(Model, error)} A Promise that is fulfilled with a Model instance or rejected with an error
     */

  }, {
    key: 'getOutputInfo',
    value: function getOutputInfo(model) {
      var _this8 = this;

      return new Promise(function (resolve, reject) {
        _this8.initModel(model).then(function (model) {
          model.getOutputInfo().then(resolve, reject).catch(reject);
        }, reject);
      });
    }

    /**
     * Returns all the models
     * @param {Object}     options     Object with keys explained below: (optional)
     *   @param {Number}     options.page        The page number (optional, default: 1)
     *   @param {Number}     options.perPage     Number of images to return per page (optional, default: 20)
     * @return {Promise(Models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
     */

  }, {
    key: 'list',
    value: function list() {
      var _this9 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + MODELS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, {
            params: { 'per_page': options.perPage, 'page': options.page },
            headers: headers
          }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Models(_this9._config, response.data.models));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Create a model
     * @param {string|object}                  model                                  If string, it is assumed to be the model id. Otherwise, if object is given, it can have any of the following keys:
     *   @param {string}                         model.id                               Model id
     *   @param {string}                         model.name                             Model name
     * @param {object[]|string[]|Concepts[]}   conceptsData                           List of objects with ids, concept id strings or an instance of Concepts object
     * @param {Object}                         options                                Object with keys explained below:
     *   @param {boolean}                        options.conceptsMutuallyExclusive      Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
     *   @param {boolean}                        options.closedEnvironment              Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
     * @return {Promise(Model, error)} A Promise that is fulfilled with an instance of Model or rejected with an error
     */

  }, {
    key: 'create',
    value: function create(model) {
      var _this10 = this;

      var conceptsData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var concepts = conceptsData instanceof Concepts ? conceptsData.toObject('id') : conceptsData.map(function (concept) {
        var val = concept;
        if (checkType(/String/, concept)) {
          val = { 'id': concept };
        }
        return val;
      });
      var modelObj = model;
      if (checkType(/String/, model)) {
        modelObj = { id: model, name: model };
      }
      if (modelObj.id === undefined) {
        throw ERRORS.paramsRequired('Model ID');
      }
      var url = '' + this._config.basePath + MODELS_PATH;
      var data = { model: modelObj };
      data['model']['output_info'] = {
        'data': {
          concepts: concepts
        },
        'output_config': {
          'concepts_mutually_exclusive': !!options.conceptsMutuallyExclusive,
          'closed_environment': !!options.closedEnvironment
        }
      };

      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Model(_this10._config, response.data.model));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Returns a model specified by ID
     * @param {String}     id          The model's id
     * @return {Promise(Model, error)} A Promise that is fulfilled with an instance of Model or rejected with an error
     */

  }, {
    key: 'get',
    value: function get(id) {
      var _this11 = this;

      var url = '' + this._config.basePath + replaceVars(MODEL_PATH, [id]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Model(_this11._config, response.data.model));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Update a model's or a list of models' output config or concepts
     * @param {object|object[]}      models                                 Can be a single model object or list of model objects with the following attrs:
     *   @param {string}               models.id                                    The id of the model to apply changes to (Required)
     *   @param {string}               models.name                                  The new name of the model to update with
     *   @param {boolean}              models.conceptsMutuallyExclusive             Do you expect to see more than one of the concepts in this model in the SAME image? Set to false (default) if so. Otherwise, set to true.
     *   @param {boolean}              models.closedEnvironment                     Do you expect to run the trained model on images that do not contain ANY of the concepts in the model? Set to false (default) if so. Otherwise, set to true.
     *   @param {object[]}             models.concepts                              An array of concept objects or string
     *     @param {object|string}        models.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
     *       @param {string}             models.concepts[].concept.id                   The id of the concept to attach to the model
     *   @param {object[]}             models.action                                The action to perform on the given concepts. Possible values are 'merge', 'remove', or 'overwrite'. Default: 'merge'
     * @return {Promise(Models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
     */

  }, {
    key: 'update',
    value: function update(models) {
      var _this12 = this;

      var url = '' + this._config.basePath + MODELS_PATH;
      var modelsList = Array.isArray(models) ? models : [models];
      var data = { models: modelsList.map(formatModel) };
      data['action'] = models.action || 'merge';
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.patch(url, data, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Models(_this12._config, response.data.models));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }

    /**
     * Update model by merging concepts
     * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
     *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
     *   @param {object[]}             model.concepts                              An array of concept objects or string
     *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
     *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
     */

  }, {
    key: 'mergeConcepts',
    value: function mergeConcepts() {
      var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      model.action = 'merge';
      return this.update(model);
    }

    /**
     * Update model by removing concepts
     * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
     *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
     *   @param {object[]}             model.concepts                              An array of concept objects or string
     *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
     *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
     */

  }, {
    key: 'deleteConcepts',
    value: function deleteConcepts() {
      var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      model.action = 'remove';
      return this.update(model);
    }

    /**
     * Update model by overwriting concepts
     * @param {object|object[]}      model                                 Can be a single model object or list of model objects with the following attrs:
     *   @param {string}               model.id                                    The id of the model to apply changes to (Required)
     *   @param {object[]}             model.concepts                              An array of concept objects or string
     *     @param {object|string}        model.concepts[].concept                    If string is given, this is interpreted as concept id. Otherwise, if object is given, client expects the following attributes
     *       @param {string}             model.concepts[].concept.id                   The id of the concept to attach to the model
     */

  }, {
    key: 'overwriteConcepts',
    value: function overwriteConcepts() {
      var model = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      model.action = 'overwrite';
      return this.update(model);
    }

    /**
     * Deletes all models (if no ids and versionId given) or a model (if given id) or a model version (if given id and verion id)
     * @param {String|String[]}      ids         Can be a single string or an array of strings representing the model ids
     * @param {String}               versionId   The model's version id
     * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
     */

  }, {
    key: 'delete',
    value: function _delete(ids) {
      var versionId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      var request = void 0,
          url = void 0,
          data = void 0;
      var id = ids;

      if (checkType(/String/, ids) || checkType(/Array/, ids) && ids.length === 1) {
        if (versionId) {
          url = '' + this._config.basePath + replaceVars(MODEL_VERSION_PATH, [id, versionId]);
        } else {
          url = '' + this._config.basePath + replaceVars(MODEL_PATH, [id]);
        }
        request = wrapToken(this._config, function (headers) {
          return new Promise(function (resolve, reject) {
            axios.delete(url, { headers: headers }).then(function (response) {
              var data = clone(response.data);
              data.rawData = clone(response.data);
              resolve(data);
            }, reject);
          });
        });
      } else {
        if (!ids && !versionId) {
          url = '' + this._config.basePath + MODELS_PATH;
          data = { 'delete_all': true };
        } else if (!versionId && ids.length > 1) {
          url = '' + this._config.basePath + MODELS_PATH;
          data = { ids: ids };
        } else {
          throw ERRORS.INVALID_DELETE_ARGS;
        }
        request = wrapToken(this._config, function (headers) {
          return new Promise(function (resolve, reject) {
            axios({
              method: 'delete',
              url: url,
              data: data,
              headers: headers
            }).then(function (response) {
              var data = clone(response.data);
              data.rawData = clone(response.data);
              resolve(data);
            }, reject);
          });
        });
      }

      return request;
    }

    /**
     * Search for models by name or type
     * @param {String}     name        The model name
     * @param {String}     type        This can be "concept", "color", "embed", "facedetect", "cluster" or "blur"
     * @return {Promise(models, error)} A Promise that is fulfilled with an instance of Models or rejected with an error
     */

  }, {
    key: 'search',
    value: function search(name) {
      var _this13 = this;

      var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      var url = '' + this._config.basePath + MODEL_SEARCH_PATH;
      return wrapToken(this._config, function (headers) {
        var params = {
          'model_query': {
            name: name,
            type: type
          }
        };
        return new Promise(function (resolve, reject) {
          axios.post(url, params, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Models(_this13._config, response.data.models));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }]);

  return Models;
}();

module.exports = Models;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVscy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJQcm9taXNlIiwiTW9kZWwiLCJDb25jZXB0cyIsIkFQSSIsIkVSUk9SUyIsInJlcGxhY2VWYXJzIiwiaXNTdWNjZXNzIiwiY2hlY2tUeXBlIiwiY2xvbmUiLCJ3cmFwVG9rZW4iLCJmb3JtYXRNb2RlbCIsIk1PREVMU19QQVRIIiwiTU9ERUxfUEFUSCIsIk1PREVMX1NFQVJDSF9QQVRIIiwiTU9ERUxfVkVSU0lPTl9QQVRIIiwiTW9kZWxzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwibW9kZWxEYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJtb2RlbCIsImRhdGEiLCJmbiIsImlkIiwicmVzb2x2ZSIsInJlamVjdCIsInNlYXJjaCIsIm5hbWUiLCJ0eXBlIiwidGhlbiIsIm1vZGVscyIsInZlcnNpb24iLCJmaWx0ZXIiLCJtb2RlbFZlcnNpb24iLCJjYXRjaCIsImlucHV0cyIsImNvbmZpZyIsImNvbnNvbGUiLCJ3YXJuIiwidmlkZW8iLCJsYW5ndWFnZSIsImluaXRNb2RlbCIsIm1vZGVsT2JqIiwicHJlZGljdCIsInN5bmMiLCJ0cmFpbiIsImlucHV0IiwiZmVlZGJhY2siLCJkIiwiZSIsInZlcnNpb25JZCIsImdldFZlcnNpb24iLCJvcHRpb25zIiwicGFnZSIsInBlclBhZ2UiLCJnZXRWZXJzaW9ucyIsImdldE91dHB1dEluZm8iLCJ1cmwiLCJiYXNlUGF0aCIsImhlYWRlcnMiLCJnZXQiLCJwYXJhbXMiLCJyZXNwb25zZSIsImNvbmNlcHRzRGF0YSIsImNvbmNlcHRzIiwidG9PYmplY3QiLCJtYXAiLCJjb25jZXB0IiwidmFsIiwidW5kZWZpbmVkIiwicGFyYW1zUmVxdWlyZWQiLCJjb25jZXB0c011dHVhbGx5RXhjbHVzaXZlIiwiY2xvc2VkRW52aXJvbm1lbnQiLCJwb3N0IiwibW9kZWxzTGlzdCIsIkFycmF5IiwiaXNBcnJheSIsImFjdGlvbiIsInBhdGNoIiwidXBkYXRlIiwiaWRzIiwicmVxdWVzdCIsImRlbGV0ZSIsIklOVkFMSURfREVMRVRFX0FSR1MiLCJtZXRob2QiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQUlDLFVBQVVELFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBSUUsUUFBUUYsUUFBUSxTQUFSLENBQVo7QUFDQSxJQUFJRyxXQUFXSCxRQUFRLFlBQVIsQ0FBZjs7ZUFDaUNBLFFBQVEsYUFBUixDO0lBQTVCSSxHLFlBQUFBLEc7SUFBS0MsTSxZQUFBQSxNO0lBQVFDLFcsWUFBQUEsVzs7Z0JBQ2tCTixRQUFRLFdBQVIsQztJQUEvQk8sUyxhQUFBQSxTO0lBQVdDLFMsYUFBQUEsUztJQUFXQyxLLGFBQUFBLEs7O2dCQUNJVCxRQUFRLFNBQVIsQztJQUExQlUsUyxhQUFBQSxTO0lBQVdDLFcsYUFBQUEsVzs7SUFDWEMsVyxHQUFrRVIsRyxDQUFsRVEsVztJQUFhQyxVLEdBQXFEVCxHLENBQXJEUyxVO0lBQVlDLGlCLEdBQXlDVixHLENBQXpDVSxpQjtJQUFtQkMsa0IsR0FBc0JYLEcsQ0FBdEJXLGtCOztBQUVqRDs7Ozs7SUFJTUMsTTtBQUNKLGtCQUFZQyxPQUFaLEVBQW1DO0FBQUE7O0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUNqQyxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLQyxPQUFMLEdBQWVBLE9BQWY7QUFDQUEsWUFBUUMsT0FBUixDQUFnQixVQUFDQyxTQUFELEVBQVlDLEtBQVosRUFBc0I7QUFDcEMsWUFBS0EsS0FBTCxJQUFjLElBQUluQixLQUFKLENBQVUsTUFBS2UsT0FBZixFQUF3QkcsU0FBeEIsQ0FBZDtBQUNELEtBRkQ7QUFHQSxTQUFLRSxNQUFMLEdBQWNKLFFBQVFJLE1BQXRCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7OEJBU1VDLEssRUFBTztBQUFBOztBQUNmLFVBQUlDLE9BQU8sRUFBWDtBQUNBLFVB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RCxFQUFhO0FBQzFDLFlBQUlFLFNBQVM7QUFDWCx5QkFBZTtBQUNibEMsc0JBRGE7QUFFYkM7QUFGYTtBQURKLFNBQWI7QUFNQSxlQUFPLElBQUk5QixPQUFKLENBQVksVUFBQzBCLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtBQUN0QzdCLGdCQUFNNkUsSUFBTixDQUFXaEIsR0FBWCxFQUFnQkksTUFBaEIsRUFBd0IsRUFBQ0YsZ0JBQUQsRUFBeEIsRUFBbUM5QixJQUFuQyxDQUF3QyxVQUFDaUMsUUFBRCxFQUFjO0FBQ3BELGdCQUFJMUQsVUFBVTBELFFBQVYsQ0FBSixFQUF5QjtBQUN2QnRDLHNCQUFRLElBQUlYLE1BQUosQ0FBVyxRQUFLQyxPQUFoQixFQUF5QmdELFNBQVN6QyxJQUFULENBQWNTLE1BQXZDLENBQVI7QUFDRCxhQUZELE1BRU87QUFDTEwscUJBQU9xQyxRQUFQO0FBQ0Q7QUFDRixXQU5ELEVBTUdyQyxNQU5IO0FBT0QsU0FSTSxDQUFQO0FBU0QsT0FoQk0sQ0FBUDtBQWlCRDs7Ozs7O0FBR0g0RCxPQUFPQyxPQUFQLEdBQWlCekUsTUFBakIiLCJmaWxlIjoiTW9kZWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCBQcm9taXNlID0gcmVxdWlyZSgncHJvbWlzZScpO1xubGV0IE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xubGV0IENvbmNlcHRzID0gcmVxdWlyZSgnLi9Db25jZXB0cycpO1xubGV0IHtBUEksIEVSUk9SUywgcmVwbGFjZVZhcnN9ID0gcmVxdWlyZSgnLi9jb25zdGFudHMnKTtcbmxldCB7aXNTdWNjZXNzLCBjaGVja1R5cGUsIGNsb25lfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IHt3cmFwVG9rZW4sIGZvcm1hdE1vZGVsfSA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmxldCB7TU9ERUxTX1BBVEgsIE1PREVMX1BBVEgsIE1PREVMX1NFQVJDSF9QQVRILCBNT0RFTF9WRVJTSU9OX1BBVEh9ID0gQVBJO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIGNvbGxlY3Rpb24gb2YgbW9kZWxzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgTW9kZWxzIHtcbiAgY29uc3RydWN0b3IoX2NvbmZpZywgcmF3RGF0YSA9IFtdKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSByYXdEYXRhO1xuICAgIHJhd0RhdGEuZm9yRWFjaCgobW9kZWxEYXRhLCBpbmRleCkgPT4ge1xuICAgICAgdGhpc1tpbmRleF0gPSBuZXcgTW9kZWwodGhpcy5fY29uZmlnLCBtb2RlbERhdGEpO1xuICAgIH0pO1xuICAgIHRoaXMubGVuZ3RoID0gcmF3RGF0YS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIE1vZGVsIGluc3RhbmNlIGdpdmVuIG1vZGVsIGlkIG9yIG5hbWUuIEl0IHdpbGwgY2FsbCBzZWFyY2ggaWYgbmFtZSBpcyBnaXZlbi5cbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICBtb2RlbCAgICAgICBJZiBzdHJpbmcsIGl0IGlzIGFzc3VtZWQgdG8gYmUgbW9kZWwgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBpdCBjYW4gaGF2ZSBhbnkgb2YgdGhlIGZvbGxvd2luZyBrZXlzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLnZlcnNpb24gICAgIE1vZGVsIHZlcnNpb25cbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBpbml0TW9kZWwobW9kZWwpIHtcbiAgICBsZXQgZGF0YSA9IHt9O1xuICAgIGxldCBmbjtcbiAgICBpZiAoY2hlY2tUeXBlKC9TdHJpbmcvLCBtb2RlbCkpIHtcbiAgICAgIGRhdGEuaWQgPSBtb2RlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IG1vZGVsO1xuICAgIH1cbiAgICBpZiAoZGF0YS5pZCkge1xuICAgICAgZm4gPSAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgZGF0YSkpO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm4gPSAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuc2VhcmNoKGRhdGEubmFtZSwgZGF0YS50eXBlKS50aGVuKChtb2RlbHMpID0+IHtcbiAgICAgICAgICBpZiAoZGF0YS52ZXJzaW9uKSB7XG4gICAgICAgICAgICByZXNvbHZlKG1vZGVscy5yYXdEYXRhLmZpbHRlcigobW9kZWwpID0+IG1vZGVsLm1vZGVsVmVyc2lvbi5pZCA9PT0gZGF0YS52ZXJzaW9uKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc29sdmUobW9kZWxzWzBdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCkuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmbik7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgcHJlZGljdCBnaXZlbiBtb2RlbCBpbmZvIGFuZCBpbnB1dHMgdG8gcHJlZGljdCBvblxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmxhbmd1YWdlICAgIE1vZGVsIGxhbmd1YWdlIChvbmx5IGZvciBDbGFyaWZhaSdzIHB1YmxpYyBtb2RlbHMpXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEBwYXJhbSB7b2JqZWN0W118b2JqZWN0fHN0cmluZ30gICBpbnB1dHMgICAgQW4gYXJyYXkgb2Ygb2JqZWN0cy9vYmplY3Qvc3RyaW5nIHBvaW50aW5nIHRvIGFuIGltYWdlIHJlc291cmNlLiBBIHN0cmluZyBjYW4gZWl0aGVyIGJlIGEgdXJsIG9yIGJhc2U2NCBpbWFnZSBieXRlcy4gT2JqZWN0IGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICBpbnB1dHNbXS5pbWFnZSAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6XG4gICAqICAgICAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UuKHVybHxiYXNlNjQpICBDYW4gYmUgYSBwdWJsaWNseSBhY2Nlc3NpYmx5IHVybCBvciBiYXNlNjQgc3RyaW5nIHJlcHJlc2VudGluZyBpbWFnZSBieXRlcyAocmVxdWlyZWQpXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNWaWRlbyAgaW5kaWNhdGVzIGlmIHRoZSBpbnB1dCBzaG91bGQgYmUgcHJvY2Vzc2VkIGFzIGEgdmlkZW8gKGRlZmF1bHQgZmFsc2UpXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBwcmVkaWN0KG1vZGVsLCBpbnB1dHMsIGNvbmZpZyA9IHt9KSB7XG4gICAgaWYgKGNoZWNrVHlwZSgvQm9vbGVhbi8sIGNvbmZpZykpIHtcbiAgICAgIGNvbnNvbGUud2FybignXCJpc1ZpZGVvXCIgYXJndW1lbnQgaXMgZGVwcmVjYXRlZCwgY29uc2lkZXIgdXNpbmcgdGhlIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGluc3RlYWQnKTtcbiAgICAgIGNvbmZpZyA9IHtcbiAgICAgICAgdmlkZW86IGNvbmZpZ1xuICAgICAgfTtcbiAgICB9XG4gICAgaWYgKG1vZGVsLmxhbmd1YWdlKSB7XG4gICAgICBjb25maWcubGFuZ3VhZ2UgPSBtb2RlbC5sYW5ndWFnZTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbE9iaikgPT4ge1xuICAgICAgICBtb2RlbE9iai5wcmVkaWN0KGlucHV0cywgY29uZmlnKVxuICAgICAgICAgIC50aGVuKHJlc29sdmUsIHJlamVjdClcbiAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH0sIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgdHJhaW4gb24gYSBtb2RlbCBhbmQgY3JlYXRlcyBhIG5ldyBtb2RlbCB2ZXJzaW9uIGdpdmVuIG1vZGVsIGluZm9cbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICAgICAgc3luYyAgICAgICAgSWYgdHJ1ZSwgdGhpcyByZXR1cm5zIGFmdGVyIG1vZGVsIGhhcyBjb21wbGV0ZWx5IHRyYWluZWQuIElmIGZhbHNlLCB0aGlzIGltbWVkaWF0ZWx5IHJldHVybnMgZGVmYXVsdCBhcGkgcmVzcG9uc2UuXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICB0cmFpbihtb2RlbCwgc3luYyA9IGZhbHNlKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbCkgPT4ge1xuICAgICAgICBtb2RlbC50cmFpbihzeW5jKVxuICAgICAgICAgIC50aGVuKHJlc29sdmUsIHJlamVjdClcbiAgICAgICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgICAgIH0sIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXQgQSBzdHJpbmcgcG9pbnRpbmcgdG8gYW4gaW1hZ2UgcmVzb3VyY2UuIEEgc3RyaW5nIG11c3QgYmUgYSB1cmxcbiAgICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZyBBIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGNvbnNpc3Rpbmcgb2YgdGhlIGZvbGxvd2luZyByZXF1aXJlZCBrZXlzXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9IGNvbmZpZy5pZCBUaGUgaWQgb2YgdGhlIGZlZWRiYWNrIHJlcXVlc3RcbiAgICogICBAcGFyYW0ge29iamVjdH0gY29uZmlnLmRhdGEgVGhlIGZlZWRiYWNrIGRhdGEgdG8gYmUgc2VudFxuICAgKiAgIEBwYXJhbSB7b2JqZWN0fSBjb25maWcuaW5mbyBNZXRhIGRhdGEgcmVsYXRlZCB0byB0aGUgZmVlZGJhY2sgcmVxdWVzdFxuICAgKi9cbiAgZmVlZGJhY2sobW9kZWwsIGlucHV0LCBjb25maWcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5pbml0TW9kZWwobW9kZWwpXG4gICAgICAgIC50aGVuKG1vZGVsID0+IHtcbiAgICAgICAgICByZXR1cm4gbW9kZWwuZmVlZGJhY2soaW5wdXQsIGNvbmZpZyk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGQgPT4gcmVzb2x2ZShkKSlcbiAgICAgICAgLmNhdGNoKGUgPT4gcmVqZWN0KGUpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgdmVyc2lvbiBvZiB0aGUgbW9kZWwgc3BlY2lmaWVkIGJ5IGl0cyBpZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEBwYXJhbSB7c3RyaW5nfSAgICAgdmVyc2lvbklkICAgVGhlIG1vZGVsJ3MgaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldFZlcnNpb24obW9kZWwsIHZlcnNpb25JZCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLmluaXRNb2RlbChtb2RlbCkudGhlbigobW9kZWwpID0+IHtcbiAgICAgICAgbW9kZWwuZ2V0VmVyc2lvbih2ZXJzaW9uSWQpXG4gICAgICAgICAgLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbGlzdCBvZiB2ZXJzaW9ucyBvZiB0aGUgbW9kZWxcbiAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSAgICAgICAgICAgIG1vZGVsICAgICAgIElmIHN0cmluZywgaXQgaXMgYXNzdW1lZCB0byBiZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgIE1vZGVsIG5hbWVcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwudmVyc2lvbiAgICAgTW9kZWwgdmVyc2lvblxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC50eXBlICAgICAgICBUaGlzIGNhbiBiZSBcImNvbmNlcHRcIiwgXCJjb2xvclwiLCBcImVtYmVkXCIsIFwiZmFjZWRldGVjdFwiLCBcImNsdXN0ZXJcIiBvciBcImJsdXJcIlxuICAgKiBAcGFyYW0ge29iamVjdH0gICAgICAgICAgICAgICAgICAgb3B0aW9ucyAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6IChvcHRpb25hbClcbiAgICogICBAcGFyYW0ge251bWJlcn0gICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgICAgICAgICAgICBvcHRpb25zLnBlclBhZ2UgICAgIE51bWJlciBvZiBpbWFnZXMgdG8gcmV0dXJuIHBlciBwYWdlIChvcHRpb25hbCwgZGVmYXVsdDogMjApXG4gICAqIEByZXR1cm4ge1Byb21pc2UocmVzcG9uc2UsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggdGhlIEFQSSByZXNwb25zZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRWZXJzaW9ucyhtb2RlbCwgb3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5pbml0TW9kZWwobW9kZWwpLnRoZW4oKG1vZGVsKSA9PiB7XG4gICAgICAgIG1vZGVsLmdldFZlcnNpb25zKG9wdGlvbnMpXG4gICAgICAgICAgLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCB0aGUgbW9kZWwncyBvdXRwdXQgaW5mb1xuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgbW9kZWwgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIG1vZGVsIGlkLiBPdGhlcndpc2UsIGlmIG9iamVjdCBpcyBnaXZlbiwgaXQgY2FuIGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcga2V5czpcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgTW9kZWwgaWRcbiAgICogICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgbW9kZWwubmFtZSAgICAgICAgTW9kZWwgbmFtZVxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgICAgICBtb2RlbC52ZXJzaW9uICAgICBNb2RlbCB2ZXJzaW9uXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgIG1vZGVsLnR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UoTW9kZWwsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYSBNb2RlbCBpbnN0YW5jZSBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBnZXRPdXRwdXRJbmZvKG1vZGVsKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuaW5pdE1vZGVsKG1vZGVsKS50aGVuKChtb2RlbCkgPT4ge1xuICAgICAgICBtb2RlbC5nZXRPdXRwdXRJbmZvKClcbiAgICAgICAgICAudGhlbihyZXNvbHZlLCByZWplY3QpXG4gICAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgICB9LCByZWplY3QpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYWxsIHRoZSBtb2RlbHNcbiAgICogQHBhcmFtIHtPYmplY3R9ICAgICBvcHRpb25zICAgICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICAgb3B0aW9ucy5wYWdlICAgICAgICBUaGUgcGFnZSBudW1iZXIgKG9wdGlvbmFsLCBkZWZhdWx0OiAxKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICAgb3B0aW9ucy5wZXJQYWdlICAgICBOdW1iZXIgb2YgaW1hZ2VzIHRvIHJldHVybiBwZXIgcGFnZSAob3B0aW9uYWwsIGRlZmF1bHQ6IDIwKVxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVscywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBNb2RlbHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgbGlzdChvcHRpb25zID0ge3BhZ2U6IDEsIHBlclBhZ2U6IDIwfSkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtNT0RFTFNfUEFUSH1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge1xuICAgICAgICAgIHBhcmFtczogeydwZXJfcGFnZSc6IG9wdGlvbnMucGVyUGFnZSwgJ3BhZ2UnOiBvcHRpb25zLnBhZ2V9LFxuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWxzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbHMpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBtb2RlbFxuICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9ICAgICAgICAgICAgICAgICAgbW9kZWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nLCBpdCBpcyBhc3N1bWVkIHRvIGJlIHRoZSBtb2RlbCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGl0IGNhbiBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIGtleXM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1vZGVsIGlkXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsLm5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1vZGVsIG5hbWVcbiAgICogQHBhcmFtIHtvYmplY3RbXXxzdHJpbmdbXXxDb25jZXB0c1tdfSAgIGNvbmNlcHRzRGF0YSAgICAgICAgICAgICAgICAgICAgICAgICAgIExpc3Qgb2Ygb2JqZWN0cyB3aXRoIGlkcywgY29uY2VwdCBpZCBzdHJpbmdzIG9yIGFuIGluc3RhbmNlIG9mIENvbmNlcHRzIG9iamVjdFxuICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0IHdpdGgga2V5cyBleHBsYWluZWQgYmVsb3c6XG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuY29uY2VwdHNNdXR1YWxseUV4Y2x1c2l2ZSAgICAgIERvIHlvdSBleHBlY3QgdG8gc2VlIG1vcmUgdGhhbiBvbmUgb2YgdGhlIGNvbmNlcHRzIGluIHRoaXMgbW9kZWwgaW4gdGhlIFNBTUUgaW1hZ2U/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuY2xvc2VkRW52aXJvbm1lbnQgICAgICAgICAgICAgIERvIHlvdSBleHBlY3QgdG8gcnVuIHRoZSB0cmFpbmVkIG1vZGVsIG9uIGltYWdlcyB0aGF0IGRvIG5vdCBjb250YWluIEFOWSBvZiB0aGUgY29uY2VwdHMgaW4gdGhlIG1vZGVsPyBTZXQgdG8gZmFsc2UgKGRlZmF1bHQpIGlmIHNvLiBPdGhlcndpc2UsIHNldCB0byB0cnVlLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVsIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGNyZWF0ZShtb2RlbCwgY29uY2VwdHNEYXRhID0gW10sIG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCBjb25jZXB0cyA9IGNvbmNlcHRzRGF0YSBpbnN0YW5jZW9mIENvbmNlcHRzID9cbiAgICAgIGNvbmNlcHRzRGF0YS50b09iamVjdCgnaWQnKSA6XG4gICAgICBjb25jZXB0c0RhdGEubWFwKChjb25jZXB0KSA9PiB7XG4gICAgICAgIGxldCB2YWwgPSBjb25jZXB0O1xuICAgICAgICBpZiAoY2hlY2tUeXBlKC9TdHJpbmcvLCBjb25jZXB0KSkge1xuICAgICAgICAgIHZhbCA9IHsnaWQnOiBjb25jZXB0fTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgfSk7XG4gICAgbGV0IG1vZGVsT2JqID0gbW9kZWw7XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgbW9kZWwpKSB7XG4gICAgICBtb2RlbE9iaiA9IHtpZDogbW9kZWwsIG5hbWU6IG1vZGVsfTtcbiAgICB9XG4gICAgaWYgKG1vZGVsT2JqLmlkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IEVSUk9SUy5wYXJhbXNSZXF1aXJlZCgnTW9kZWwgSUQnKTtcbiAgICB9XG4gICAgbGV0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke01PREVMU19QQVRIfWA7XG4gICAgbGV0IGRhdGEgPSB7bW9kZWw6IG1vZGVsT2JqfTtcbiAgICBkYXRhWydtb2RlbCddWydvdXRwdXRfaW5mbyddID0ge1xuICAgICAgJ2RhdGEnOiB7XG4gICAgICAgIGNvbmNlcHRzXG4gICAgICB9LFxuICAgICAgJ291dHB1dF9jb25maWcnOiB7XG4gICAgICAgICdjb25jZXB0c19tdXR1YWxseV9leGNsdXNpdmUnOiAhIW9wdGlvbnMuY29uY2VwdHNNdXR1YWxseUV4Y2x1c2l2ZSxcbiAgICAgICAgJ2Nsb3NlZF9lbnZpcm9ubWVudCc6ICEhb3B0aW9ucy5jbG9zZWRFbnZpcm9ubWVudFxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBkYXRhLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVsKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBtb2RlbCBzcGVjaWZpZWQgYnkgSURcbiAgICogQHBhcmFtIHtTdHJpbmd9ICAgICBpZCAgICAgICAgICBUaGUgbW9kZWwncyBpZFxuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVsLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVsIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGdldChpZCkge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9QQVRILCBbaWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZ2V0KHVybCwge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyBNb2RlbCh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWwpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgYSBtb2RlbCdzIG9yIGEgbGlzdCBvZiBtb2RlbHMnIG91dHB1dCBjb25maWcgb3IgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgbW9kZWxzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVscy5pZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBpZCBvZiB0aGUgbW9kZWwgdG8gYXBwbHkgY2hhbmdlcyB0byAoUmVxdWlyZWQpXG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgbW9kZWxzLm5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIG5ldyBuYW1lIG9mIHRoZSBtb2RlbCB0byB1cGRhdGUgd2l0aFxuICAgKiAgIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgIG1vZGVscy5jb25jZXB0c011dHVhbGx5RXhjbHVzaXZlICAgICAgICAgICAgIERvIHlvdSBleHBlY3QgdG8gc2VlIG1vcmUgdGhhbiBvbmUgb2YgdGhlIGNvbmNlcHRzIGluIHRoaXMgbW9kZWwgaW4gdGhlIFNBTUUgaW1hZ2U/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgbW9kZWxzLmNsb3NlZEVudmlyb25tZW50ICAgICAgICAgICAgICAgICAgICAgRG8geW91IGV4cGVjdCB0byBydW4gdGhlIHRyYWluZWQgbW9kZWwgb24gaW1hZ2VzIHRoYXQgZG8gbm90IGNvbnRhaW4gQU5ZIG9mIHRoZSBjb25jZXB0cyBpbiB0aGUgbW9kZWw/IFNldCB0byBmYWxzZSAoZGVmYXVsdCkgaWYgc28uIE90aGVyd2lzZSwgc2V0IHRvIHRydWUuXG4gICAqICAgQHBhcmFtIHtvYmplY3RbXX0gICAgICAgICAgICAgbW9kZWxzLmNvbmNlcHRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgb2YgY29uY2VwdCBvYmplY3RzIG9yIHN0cmluZ1xuICAgKiAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgbW9kZWxzLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVscy5jb25jZXB0c1tdLmNvbmNlcHQuaWQgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBjb25jZXB0IHRvIGF0dGFjaCB0byB0aGUgbW9kZWxcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbHMuYWN0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgYWN0aW9uIHRvIHBlcmZvcm0gb24gdGhlIGdpdmVuIGNvbmNlcHRzLiBQb3NzaWJsZSB2YWx1ZXMgYXJlICdtZXJnZScsICdyZW1vdmUnLCBvciAnb3ZlcndyaXRlJy4gRGVmYXVsdDogJ21lcmdlJ1xuICAgKiBAcmV0dXJuIHtQcm9taXNlKE1vZGVscywgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCBhbiBpbnN0YW5jZSBvZiBNb2RlbHMgb3IgcmVqZWN0ZWQgd2l0aCBhbiBlcnJvclxuICAgKi9cbiAgdXBkYXRlKG1vZGVscykge1xuICAgIGxldCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtNT0RFTFNfUEFUSH1gO1xuICAgIGxldCBtb2RlbHNMaXN0ID0gQXJyYXkuaXNBcnJheShtb2RlbHMpID8gbW9kZWxzIDogW21vZGVsc107XG4gICAgbGV0IGRhdGEgPSB7bW9kZWxzOiBtb2RlbHNMaXN0Lm1hcChmb3JtYXRNb2RlbCl9O1xuICAgIGRhdGFbJ2FjdGlvbiddID0gbW9kZWxzLmFjdGlvbiB8fCAnbWVyZ2UnO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucGF0Y2godXJsLCBkYXRhLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IE1vZGVscyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEubW9kZWxzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IG1lcmdpbmcgY29uY2VwdHNcbiAgICogQHBhcmFtIHtvYmplY3R8b2JqZWN0W119ICAgICAgbW9kZWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDYW4gYmUgYSBzaW5nbGUgbW9kZWwgb2JqZWN0IG9yIGxpc3Qgb2YgbW9kZWwgb2JqZWN0cyB3aXRoIHRoZSBmb2xsb3dpbmcgYXR0cnM6XG4gICAqICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgICAgbW9kZWwuaWQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIG1vZGVsIHRvIGFwcGx5IGNoYW5nZXMgdG8gKFJlcXVpcmVkKVxuICAgKiAgIEBwYXJhbSB7b2JqZWN0W119ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQW4gYXJyYXkgb2YgY29uY2VwdCBvYmplY3RzIG9yIHN0cmluZ1xuICAgKiAgICAgQHBhcmFtIHtvYmplY3R8c3RyaW5nfSAgICAgICAgbW9kZWwuY29uY2VwdHNbXS5jb25jZXB0ICAgICAgICAgICAgICAgICAgICBJZiBzdHJpbmcgaXMgZ2l2ZW4sIHRoaXMgaXMgaW50ZXJwcmV0ZWQgYXMgY29uY2VwdCBpZC4gT3RoZXJ3aXNlLCBpZiBvYmplY3QgaXMgZ2l2ZW4sIGNsaWVudCBleHBlY3RzIHRoZSBmb2xsb3dpbmcgYXR0cmlidXRlc1xuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgbW9kZWwuY29uY2VwdHNbXS5jb25jZXB0LmlkICAgICAgICAgICAgICAgICAgIFRoZSBpZCBvZiB0aGUgY29uY2VwdCB0byBhdHRhY2ggdG8gdGhlIG1vZGVsXG4gICAqL1xuICBtZXJnZUNvbmNlcHRzKG1vZGVsID0ge30pIHtcbiAgICBtb2RlbC5hY3Rpb24gPSAnbWVyZ2UnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IHJlbW92aW5nIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgICAgIG1vZGVsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBtb2RlbCB0byBhcHBseSBjaGFuZ2VzIHRvIChSZXF1aXJlZClcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFuIGFycmF5IG9mIGNvbmNlcHQgb2JqZWN0cyBvciBzdHJpbmdcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIGNvbmNlcHQgdG8gYXR0YWNoIHRvIHRoZSBtb2RlbFxuICAgKi9cbiAgZGVsZXRlQ29uY2VwdHMobW9kZWwgPSB7fSkge1xuICAgIG1vZGVsLmFjdGlvbiA9ICdyZW1vdmUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG1vZGVsIGJ5IG92ZXJ3cml0aW5nIGNvbmNlcHRzXG4gICAqIEBwYXJhbSB7b2JqZWN0fG9iamVjdFtdfSAgICAgIG1vZGVsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIG1vZGVsIG9iamVjdCBvciBsaXN0IG9mIG1vZGVsIG9iamVjdHMgd2l0aCB0aGUgZm9sbG93aW5nIGF0dHJzOlxuICAgKiAgIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgICAgIG1vZGVsLmlkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVGhlIGlkIG9mIHRoZSBtb2RlbCB0byBhcHBseSBjaGFuZ2VzIHRvIChSZXF1aXJlZClcbiAgICogICBAcGFyYW0ge29iamVjdFtdfSAgICAgICAgICAgICBtb2RlbC5jb25jZXB0cyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFuIGFycmF5IG9mIGNvbmNlcHQgb2JqZWN0cyBvciBzdHJpbmdcbiAgICogICAgIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdCAgICAgICAgICAgICAgICAgICAgSWYgc3RyaW5nIGlzIGdpdmVuLCB0aGlzIGlzIGludGVycHJldGVkIGFzIGNvbmNlcHQgaWQuIE90aGVyd2lzZSwgaWYgb2JqZWN0IGlzIGdpdmVuLCBjbGllbnQgZXhwZWN0cyB0aGUgZm9sbG93aW5nIGF0dHJpYnV0ZXNcbiAgICogICAgICAgQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgIG1vZGVsLmNvbmNlcHRzW10uY29uY2VwdC5pZCAgICAgICAgICAgICAgICAgICBUaGUgaWQgb2YgdGhlIGNvbmNlcHQgdG8gYXR0YWNoIHRvIHRoZSBtb2RlbFxuICAgKi9cbiAgb3ZlcndyaXRlQ29uY2VwdHMobW9kZWwgPSB7fSkge1xuICAgIG1vZGVsLmFjdGlvbiA9ICdvdmVyd3JpdGUnO1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZShtb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBhbGwgbW9kZWxzIChpZiBubyBpZHMgYW5kIHZlcnNpb25JZCBnaXZlbikgb3IgYSBtb2RlbCAoaWYgZ2l2ZW4gaWQpIG9yIGEgbW9kZWwgdmVyc2lvbiAoaWYgZ2l2ZW4gaWQgYW5kIHZlcmlvbiBpZClcbiAgICogQHBhcmFtIHtTdHJpbmd8U3RyaW5nW119ICAgICAgaWRzICAgICAgICAgQ2FuIGJlIGEgc2luZ2xlIHN0cmluZyBvciBhbiBhcnJheSBvZiBzdHJpbmdzIHJlcHJlc2VudGluZyB0aGUgbW9kZWwgaWRzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgIHZlcnNpb25JZCAgIFRoZSBtb2RlbCdzIHZlcnNpb24gaWRcbiAgICogQHJldHVybiB7UHJvbWlzZShyZXNwb25zZSwgZXJyb3IpfSBBIFByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2l0aCB0aGUgQVBJIHJlc3BvbnNlIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGRlbGV0ZShpZHMsIHZlcnNpb25JZCA9IG51bGwpIHtcbiAgICBsZXQgcmVxdWVzdCwgdXJsLCBkYXRhO1xuICAgIGxldCBpZCA9IGlkcztcblxuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGlkcykgfHwgKGNoZWNrVHlwZSgvQXJyYXkvLCBpZHMpICYmIGlkcy5sZW5ndGggPT09IDEgKSkge1xuICAgICAgaWYgKHZlcnNpb25JZCkge1xuICAgICAgICB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhNT0RFTF9WRVJTSU9OX1BBVEgsIFtpZCwgdmVyc2lvbklkXSl9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke3JlcGxhY2VWYXJzKE1PREVMX1BBVEgsIFtpZF0pfWA7XG4gICAgICB9XG4gICAgICByZXF1ZXN0ID0gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBheGlvcy5kZWxldGUodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgZGF0YS5yYXdEYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgIH0sIHJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghaWRzICYmICF2ZXJzaW9uSWQpIHtcbiAgICAgICAgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7TU9ERUxTX1BBVEh9YDtcbiAgICAgICAgZGF0YSA9IHsnZGVsZXRlX2FsbCc6IHRydWV9O1xuICAgICAgfSBlbHNlIGlmICghdmVyc2lvbklkICYmIGlkcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke01PREVMU19QQVRIfWA7XG4gICAgICAgIGRhdGEgPSB7aWRzfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVSUk9SUy5JTlZBTElEX0RFTEVURV9BUkdTO1xuICAgICAgfVxuICAgICAgcmVxdWVzdCA9IHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgYXhpb3Moe1xuICAgICAgICAgICAgbWV0aG9kOiAnZGVsZXRlJyxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBoZWFkZXJzXG4gICAgICAgICAgfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGxldCBkYXRhID0gY2xvbmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICBkYXRhLnJhd0RhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2ggZm9yIG1vZGVscyBieSBuYW1lIG9yIHR5cGVcbiAgICogQHBhcmFtIHtTdHJpbmd9ICAgICBuYW1lICAgICAgICBUaGUgbW9kZWwgbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgIHR5cGUgICAgICAgIFRoaXMgY2FuIGJlIFwiY29uY2VwdFwiLCBcImNvbG9yXCIsIFwiZW1iZWRcIiwgXCJmYWNlZGV0ZWN0XCIsIFwiY2x1c3RlclwiIG9yIFwiYmx1clwiXG4gICAqIEByZXR1cm4ge1Byb21pc2UobW9kZWxzLCBlcnJvcil9IEEgUHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGluc3RhbmNlIG9mIE1vZGVscyBvciByZWplY3RlZCB3aXRoIGFuIGVycm9yXG4gICAqL1xuICBzZWFyY2gobmFtZSwgdHlwZSA9IG51bGwpIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7TU9ERUxfU0VBUkNIX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGxldCBwYXJhbXMgPSB7XG4gICAgICAgICdtb2RlbF9xdWVyeSc6IHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIHR5cGVcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLnBvc3QodXJsLCBwYXJhbXMsIHtoZWFkZXJzfSkudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoaXNTdWNjZXNzKHJlc3BvbnNlKSkge1xuICAgICAgICAgICAgcmVzb2x2ZShuZXcgTW9kZWxzKHRoaXMuX2NvbmZpZywgcmVzcG9uc2UuZGF0YS5tb2RlbHMpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVscztcbiJdfQ==
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Models.js","/")
},{"./Concepts":40,"./Model":43,"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27,"promise":28}],46:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Region / bounding box. Region points are percentages from the edge.
 * E.g. top of 0.2 means the cropped input will start 20% down from the original edge.
 * @class
 */
var Region = function Region(_config, data) {
  _classCallCheck(this, Region);

  this.id = data.id;
  this.top = data.region_info.bounding_box.top_row;
  this.left = data.region_info.bounding_box.left_col;
  this.bottom = data.region_info.bounding_box.bottom_row;
  this.right = data.region_info.bounding_box.right_col;
};

module.exports = Region;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlJlZ2lvbi5qcyJdLCJuYW1lcyI6WyJSZWdpb24iLCJfY29uZmlnIiwiZGF0YSIsImlkIiwidG9wIiwicmVnaW9uX2luZm8iLCJib3VuZGluZ19ib3giLCJ0b3Bfcm93IiwibGVmdCIsImxlZnRfY29sIiwiYm90dG9tIiwiYm90dG9tX3JvdyIsInJpZ2h0IiwicmlnaHRfY29sIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7OztJQUtNQSxNLEdBQ0osZ0JBQVlDLE9BQVosRUFBcUJDLElBQXJCLEVBQTJCO0FBQUE7O0FBQ3pCLE9BQUtDLEVBQUwsR0FBVUQsS0FBS0MsRUFBZjtBQUNBLE9BQUtDLEdBQUwsR0FBV0YsS0FBS0csV0FBTCxDQUFpQkMsWUFBakIsQ0FBOEJDLE9BQXpDO0FBQ0EsT0FBS0MsSUFBTCxHQUFZTixLQUFLRyxXQUFMLENBQWlCQyxZQUFqQixDQUE4QkcsUUFBMUM7QUFDQSxPQUFLQyxNQUFMLEdBQWNSLEtBQUtHLFdBQUwsQ0FBaUJDLFlBQWpCLENBQThCSyxVQUE1QztBQUNBLE9BQUtDLEtBQUwsR0FBYVYsS0FBS0csV0FBTCxDQUFpQkMsWUFBakIsQ0FBOEJPLFNBQTNDO0FBQ0QsQzs7QUFHSEMsT0FBT0MsT0FBUCxHQUFpQmYsTUFBakIiLCJmaWxlIjoiUmVnaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWdpb24gLyBib3VuZGluZyBib3guIFJlZ2lvbiBwb2ludHMgYXJlIHBlcmNlbnRhZ2VzIGZyb20gdGhlIGVkZ2UuXG4gKiBFLmcuIHRvcCBvZiAwLjIgbWVhbnMgdGhlIGNyb3BwZWQgaW5wdXQgd2lsbCBzdGFydCAyMCUgZG93biBmcm9tIHRoZSBvcmlnaW5hbCBlZGdlLlxuICogQGNsYXNzXG4gKi9cbmNsYXNzIFJlZ2lvbiB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIGRhdGEpIHtcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcbiAgICB0aGlzLnRvcCA9IGRhdGEucmVnaW9uX2luZm8uYm91bmRpbmdfYm94LnRvcF9yb3c7XG4gICAgdGhpcy5sZWZ0ID0gZGF0YS5yZWdpb25faW5mby5ib3VuZGluZ19ib3gubGVmdF9jb2w7XG4gICAgdGhpcy5ib3R0b20gPSBkYXRhLnJlZ2lvbl9pbmZvLmJvdW5kaW5nX2JveC5ib3R0b21fcm93O1xuICAgIHRoaXMucmlnaHQgPSBkYXRhLnJlZ2lvbl9pbmZvLmJvdW5kaW5nX2JveC5yaWdodF9jb2w7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWdpb247XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Region.js","/")
},{"buffer":23,"pBGvAp":27}],47:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Region = require('./Region');

/**
 * A collection of regions.
 * @class
 */

var Regions = function () {
  function Regions(_config) {
    var _this = this;

    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Regions);

    this._config = _config;
    this.rawData = rawData;
    rawData.forEach(function (regionData, index) {
      _this[index] = new Region(_this._config, regionData);
    });
    this.length = rawData.length;
  }

  _createClass(Regions, [{
    key: Symbol.iterator,
    value: function value() {
      var _this2 = this;

      var index = -1;
      return {
        next: function next() {
          return { value: _this2[++index], done: index >= _this2.length };
        }
      };
    }
  }]);

  return Regions;
}();

module.exports = Regions;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlJlZ2lvbnMuanMiXSwibmFtZXMiOlsiUmVnaW9uIiwicmVxdWlyZSIsIlJlZ2lvbnMiLCJfY29uZmlnIiwicmF3RGF0YSIsImZvckVhY2giLCJyZWdpb25EYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJTeW1ib2wiLCJpdGVyYXRvciIsIm5leHQiLCJ2YWx1ZSIsImRvbmUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxTQUFTQyxRQUFRLFVBQVIsQ0FBYjs7QUFFQTs7Ozs7SUFJTUMsTztBQUNKLG1CQUFZQyxPQUFaLEVBQW1DO0FBQUE7O0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUFBOztBQUNqQyxTQUFLRCxPQUFMLEdBQWVBLE9BQWY7QUFDQSxTQUFLQyxPQUFMLEdBQWVBLE9BQWY7QUFDQUEsWUFBUUMsT0FBUixDQUFnQixVQUFDQyxVQUFELEVBQWFDLEtBQWIsRUFBdUI7QUFDckMsWUFBS0EsS0FBTCxJQUFjLElBQUlQLE1BQUosQ0FBVyxNQUFLRyxPQUFoQixFQUF5QkcsVUFBekIsQ0FBZDtBQUNELEtBRkQ7QUFHQSxTQUFLRSxNQUFMLEdBQWNKLFFBQVFJLE1BQXRCO0FBQ0Q7OztTQUVBQyxPQUFPQyxROzRCQUFZO0FBQUE7O0FBQ2xCLFVBQUlILFFBQVEsQ0FBQyxDQUFiO0FBQ0EsYUFBTztBQUNMSSxjQUFNO0FBQUEsaUJBQU8sRUFBRUMsT0FBTyxPQUFLLEVBQUVMLEtBQVAsQ0FBVCxFQUF3Qk0sTUFBTU4sU0FBUyxPQUFLQyxNQUE1QyxFQUFQO0FBQUE7QUFERCxPQUFQO0FBR0Q7Ozs7OztBQUdITSxPQUFPQyxPQUFQLEdBQWlCYixPQUFqQiIsImZpbGUiOiJSZWdpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IFJlZ2lvbiA9IHJlcXVpcmUoJy4vUmVnaW9uJyk7XG5cbi8qKlxuICogQSBjb2xsZWN0aW9uIG9mIHJlZ2lvbnMuXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgUmVnaW9ucyB7XG4gIGNvbnN0cnVjdG9yKF9jb25maWcsIHJhd0RhdGEgPSBbXSkge1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gICAgdGhpcy5yYXdEYXRhID0gcmF3RGF0YTtcbiAgICByYXdEYXRhLmZvckVhY2goKHJlZ2lvbkRhdGEsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzW2luZGV4XSA9IG5ldyBSZWdpb24odGhpcy5fY29uZmlnLCByZWdpb25EYXRhKTtcbiAgICB9KTtcbiAgICB0aGlzLmxlbmd0aCA9IHJhd0RhdGEubGVuZ3RoO1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgbGV0IGluZGV4ID0gLTE7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+ICh7IHZhbHVlOiB0aGlzWysraW5kZXhdLCBkb25lOiBpbmRleCA+PSB0aGlzLmxlbmd0aCB9KVxuICAgIH07XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUmVnaW9ucztcbiJdfQ==
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Regions.js","/")
},{"./Region":46,"buffer":23,"pBGvAp":27}],48:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');

var _require = require('./constants'),
    API = _require.API,
    replaceVars = _require.replaceVars;

var WORKFLOWS_PATH = API.WORKFLOWS_PATH,
    WORKFLOW_PATH = API.WORKFLOW_PATH,
    WORKFLOW_RESULTS_PATH = API.WORKFLOW_RESULTS_PATH;

var _require2 = require('./utils'),
    wrapToken = _require2.wrapToken,
    formatInput = _require2.formatInput;

var _require3 = require('./helpers'),
    checkType = _require3.checkType;

/**
 * class representing a workflow
 * @class
 */


var Workflow = function () {
  function Workflow(_config) {
    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Workflow);

    this._config = _config;
    this.rawData = rawData;
    this.id = rawData.id;
    this.createdAt = rawData.created_at || rawData.createdAt;
    this.appId = rawData.app_id || rawData.appId;
  }

  /**
   * @deprecated
   */


  _createClass(Workflow, [{
    key: 'create',
    value: function create(workflowId, config) {
      var url = '' + this._config.basePath + WORKFLOWS_PATH;
      var modelId = config.modelId;
      var modelVersionId = config.modelVersionId;
      var body = {
        workflows: [{
          id: workflowId,
          nodes: [{
            id: 'concepts',
            model: {
              id: modelId,
              model_version: {
                id: modelVersionId
              }
            }
          }]
        }]
      };

      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, body, {
            headers: headers
          }).then(function (response) {
            var workflowId = response.data.workflows[0].id;
            resolve(workflowId);
          }, reject);
        });
      });
    }

    /**
     * @deprecated
     */

  }, {
    key: 'delete',
    value: function _delete(workflowId, config) {
      var url = '' + this._config.basePath + replaceVars(WORKFLOW_PATH, [workflowId]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.delete(url, {
            headers: headers
          }).then(function (response) {
            var data = response.data;
            resolve(data);
          }, reject);
        });
      });
    }

    /**
     * Returns workflow output according to inputs
     * @param {string}                   workflowId    Workflow id
     * @param {object[]|object|string}   inputs    An array of objects/object/string pointing to an image resource. A string can either be a url or base64 image bytes. Object keys explained below:
     *    @param {object}                  inputs[].image     Object with keys explained below:
     *       @param {string}                 inputs[].image.(url|base64)  Can be a publicly accessibly url or base64 string representing image bytes (required)
     */

  }, {
    key: 'predict',
    value: function predict(workflowId, inputs) {
      var url = '' + this._config.basePath + replaceVars(WORKFLOW_RESULTS_PATH, [workflowId]);
      if (checkType(/(Object|String)/, inputs)) {
        inputs = [inputs];
      }
      return wrapToken(this._config, function (headers) {
        var params = {
          inputs: inputs.map(formatInput)
        };
        return new Promise(function (resolve, reject) {
          axios.post(url, params, {
            headers: headers
          }).then(function (response) {
            var data = response.data;
            resolve(data);
          }, reject);
        });
      });
    }
  }]);

  return Workflow;
}();

module.exports = Workflow;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIldvcmtmbG93LmpzIl0sIm5hbWVzIjpbImF4aW9zIiwicmVxdWlyZSIsIkFQSSIsInJlcGxhY2VWYXJzIiwiV09SS0ZMT1dTX1BBVEgiLCJXT1JLRkxPV19QQVRIIiwiV09SS0ZMT1dfUkVTVUxUU19QQVRIIiwid3JhcFRva2VuIiwiZm9ybWF0SW5wdXQiLCJjaGVja1R5cGUiLCJXb3JrZmxvdyIsIl9jb25maWciLCJyYXdEYXRhIiwiaWQiLCJjcmVhdGVkQXQiLCJjcmVhdGVkX2F0IiwiYXBwSWQiLCJhcHBfaWQiLCJ3b3JrZmxvd0lkIiwiY29uZmlnIiwidXJsIiwiYmFzZVBhdGgiLCJtb2RlbElkIiwibW9kZWxWZXJzaW9uSWQiLCJib2R5Iiwid29ya2Zsb3dzIiwibm9kZXMiLCJtb2RlbCIsIm1vZGVsX3ZlcnNpb24iLCJoZWFkZXJzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJwb3N0IiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsImRlbGV0ZSIsImlucHV0cyIsInBhcmFtcyIsIm1hcCIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQUlBLFFBQVFDLFFBQVEsT0FBUixDQUFaOztlQUN5QkEsUUFBUSxhQUFSLEM7SUFBcEJDLEcsWUFBQUEsRztJQUFLQyxXLFlBQUFBLFc7O0lBQ0xDLGMsR0FBd0RGLEcsQ0FBeERFLGM7SUFBZ0JDLGEsR0FBd0NILEcsQ0FBeENHLGE7SUFBZUMscUIsR0FBeUJKLEcsQ0FBekJJLHFCOztnQkFDTEwsUUFBUSxTQUFSLEM7SUFBMUJNLFMsYUFBQUEsUztJQUFXQyxXLGFBQUFBLFc7O2dCQUNFUCxRQUFRLFdBQVIsQztJQUFiUSxTLGFBQUFBLFM7O0FBRUw7Ozs7OztJQUlNQyxRO0FBQ0osb0JBQVlDLE9BQVosRUFBaUM7QUFBQSxRQUFaQyxPQUFZLHVFQUFKLEVBQUk7O0FBQUE7O0FBQy9CLFNBQUtELE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtDLE9BQUwsR0FBZUEs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LE9BWk0sQ0FBUDtBQWFEOzs7Ozs7QUFHSFMsT0FBT0MsT0FBUCxHQUFpQmhDLFFBQWpCIiwiZmlsZSI6IldvcmtmbG93LmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKTtcbmxldCB7QVBJLCByZXBsYWNlVmFyc30gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtXT1JLRkxPV1NfUEFUSCwgV09SS0ZMT1dfUEFUSCwgV09SS0ZMT1dfUkVTVUxUU19QQVRIfSA9IEFQSTtcbmxldCB7d3JhcFRva2VuLCBmb3JtYXRJbnB1dH0gPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5sZXQge2NoZWNrVHlwZX0gPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcblxuLyoqXG4gKiBjbGFzcyByZXByZXNlbnRpbmcgYSB3b3JrZmxvd1xuICogQGNsYXNzXG4gKi9cbmNsYXNzIFdvcmtmbG93IHtcbiAgY29uc3RydWN0b3IoX2NvbmZpZywgcmF3RGF0YT1bXSkge1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG4gICAgdGhpcy5yYXdEYXRhID0gcmF3RGF0YTtcbiAgICB0aGlzLmlkID0gcmF3RGF0YS5pZDtcbiAgICB0aGlzLmNyZWF0ZWRBdCA9IHJhd0RhdGEuY3JlYXRlZF9hdCB8fCByYXdEYXRhLmNyZWF0ZWRBdDtcbiAgICB0aGlzLmFwcElkID0gcmF3RGF0YS5hcHBfaWQgfHwgcmF3RGF0YS5hcHBJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZFxuICAgKi9cbiAgY3JlYXRlKHdvcmtmbG93SWQsIGNvbmZpZykge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2NvbmZpZy5iYXNlUGF0aH0ke1dPUktGTE9XU19QQVRIfWA7XG4gICAgY29uc3QgbW9kZWxJZCA9IGNvbmZpZy5tb2RlbElkO1xuICAgIGNvbnN0IG1vZGVsVmVyc2lvbklkID0gY29uZmlnLm1vZGVsVmVyc2lvbklkO1xuICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICB3b3JrZmxvd3M6IFt7XG4gICAgICAgIGlkOiB3b3JrZmxvd0lkLFxuICAgICAgICBub2RlczogW3tcbiAgICAgICAgICBpZDogJ2NvbmNlcHRzJyxcbiAgICAgICAgICBtb2RlbDoge1xuICAgICAgICAgICAgaWQ6IG1vZGVsSWQsXG4gICAgICAgICAgICBtb2RlbF92ZXJzaW9uOiB7XG4gICAgICAgICAgICAgIGlkOiBtb2RlbFZlcnNpb25JZFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfV1cbiAgICAgIH1dXG4gICAgfTtcblxuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MucG9zdCh1cmwsIGJvZHksIHtcbiAgICAgICAgICBoZWFkZXJzXG4gICAgICAgIH0pLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgIGNvbnN0IHdvcmtmbG93SWQgPSByZXNwb25zZS5kYXRhLndvcmtmbG93c1swXS5pZDtcbiAgICAgICAgICByZXNvbHZlKHdvcmtmbG93SWQpO1xuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWRcbiAgICovXG4gIGRlbGV0ZSh3b3JrZmxvd0lkLCBjb25maWcpIHtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhXT1JLRkxPV19QQVRILCBbd29ya2Zsb3dJZF0pfWA7XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5kZWxldGUodXJsLCB7XG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB3b3JrZmxvdyBvdXRwdXQgYWNjb3JkaW5nIHRvIGlucHV0c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgICAgd29ya2Zsb3dJZCAgICBXb3JrZmxvdyBpZFxuICAgKiBAcGFyYW0ge29iamVjdFtdfG9iamVjdHxzdHJpbmd9ICAgaW5wdXRzICAgIEFuIGFycmF5IG9mIG9iamVjdHMvb2JqZWN0L3N0cmluZyBwb2ludGluZyB0byBhbiBpbWFnZSByZXNvdXJjZS4gQSBzdHJpbmcgY2FuIGVpdGhlciBiZSBhIHVybCBvciBiYXNlNjQgaW1hZ2UgYnl0ZXMuIE9iamVjdCBrZXlzIGV4cGxhaW5lZCBiZWxvdzpcbiAgICogICAgQHBhcmFtIHtvYmplY3R9ICAgICAgICAgICAgICAgICAgaW5wdXRzW10uaW1hZ2UgICAgIE9iamVjdCB3aXRoIGtleXMgZXhwbGFpbmVkIGJlbG93OlxuICAgKiAgICAgICBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICAgICAgIGlucHV0c1tdLmltYWdlLih1cmx8YmFzZTY0KSAgQ2FuIGJlIGEgcHVibGljbHkgYWNjZXNzaWJseSB1cmwgb3IgYmFzZTY0IHN0cmluZyByZXByZXNlbnRpbmcgaW1hZ2UgYnl0ZXMgKHJlcXVpcmVkKVxuICAgKi9cbiAgcHJlZGljdCh3b3JrZmxvd0lkLCBpbnB1dHMpIHtcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9jb25maWcuYmFzZVBhdGh9JHtyZXBsYWNlVmFycyhXT1JLRkxPV19SRVNVTFRTX1BBVEgsIFt3b3JrZmxvd0lkXSl9YDtcbiAgICBpZiAoY2hlY2tUeXBlKC8oT2JqZWN0fFN0cmluZykvLCBpbnB1dHMpKSB7XG4gICAgICBpbnB1dHMgPSBbaW5wdXRzXTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgIGlucHV0czogaW5wdXRzLm1hcChmb3JtYXRJbnB1dClcbiAgICAgIH07XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgcGFyYW1zLCB7XG4gICAgICAgICAgaGVhZGVyc1xuICAgICAgICB9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdvcmtmbG93O1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Workflow.js","/")
},{"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27}],49:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');
var Workflow = require('./Workflow');

var _require = require('./constants'),
    API = _require.API,
    replaceVars = _require.replaceVars;

var WORKFLOWS_PATH = API.WORKFLOWS_PATH,
    WORKFLOW_PATH = API.WORKFLOW_PATH;

var _require2 = require('./utils'),
    wrapToken = _require2.wrapToken;

var _require3 = require('./helpers'),
    isSuccess = _require3.isSuccess;

/**
 * class representing a collection of workflows
 * @class
 */


var Workflows = function () {
  function Workflows(_config) {
    var _this = this;

    var rawData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, Workflows);

    this._config = _config;
    this.rawData = rawData;
    rawData.forEach(function (workflowData, index) {
      _this[index] = new Workflow(_this._config, workflowData);
    });
    this.length = rawData.length;
  }

  /**
   * Get all workflows in app
   * @param {Object}    options  Object with keys explained below: (optional)
   *   @param {Number}    options.page  The page number (optional, default: 1)
   *   @param {Number}    options.perPage  Number of images to return per page (optional, default: 20)
   * @return {Promise(Workflows, error)} A Promise that is fulfilled with an instance of Workflows or rejected with an error
   */


  _createClass(Workflows, [{
    key: 'list',
    value: function list() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { page: 1, perPage: 20 };

      var url = '' + this._config.basePath + WORKFLOWS_PATH;
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.get(url, {
            headers: headers,
            params: {
              page: options.page,
              per_page: options.perPage
            }
          }).then(function (response) {
            if (isSuccess(response)) {
              resolve(new Workflows(_this2._config, response.data.workflows));
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }, {
    key: 'create',
    value: function create(workflowId, config) {
      var url = '' + this._config.basePath + WORKFLOWS_PATH;
      var modelId = config.modelId;
      var modelVersionId = config.modelVersionId;
      var body = {
        workflows: [{
          id: workflowId,
          nodes: [{
            id: 'concepts',
            model: {
              id: modelId,
              model_version: {
                id: modelVersionId
              }
            }
          }]
        }]
      };

      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.post(url, body, {
            headers: headers
          }).then(function (response) {
            var workflowId = response.data.workflows[0].id;
            resolve(workflowId);
          }, reject);
        });
      });
    }
  }, {
    key: 'delete',
    value: function _delete(workflowId) {
      var url = '' + this._config.basePath + replaceVars(WORKFLOW_PATH, [workflowId]);
      return wrapToken(this._config, function (headers) {
        return new Promise(function (resolve, reject) {
          axios.delete(url, {
            headers: headers
          }).then(function (response) {
            var data = response.data;
            resolve(data);
          }, reject);
        });
      });
    }
  }]);

  return Workflows;
}();

;

module.exports = Workflows;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIldvcmtmbG93cy5qcyJdLCJuYW1lcyI6WyJheGlvcyIsInJlcXVpcmUiLCJXb3JrZmxvdyIsIkFQSSIsInJlcGxhY2VWYXJzIiwiV09SS0ZMT1dTX1BBVEgiLCJXT1JLRkxPV19QQVRIIiwid3JhcFRva2VuIiwiaXNTdWNjZXNzIiwiV29ya2Zsb3dzIiwiX2NvbmZpZyIsInJhd0RhdGEiLCJmb3JFYWNoIiwid29ya2Zsb3dEYXRhIiwiaW5kZXgiLCJsZW5ndGgiLCJvcHRpb25zIiwicGFnZSIsInBlclBhZ2UiLCJ1cmwiLCJiYXNlUGF0aCIsImhlYWRlcnMiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImdldCIsInBhcmFtcyIsInBlcl9wYWdlIiwidGhlbiIsInJlc3BvbnNlIiwiZGF0YSIsIndvcmtmbG93cyIsIndvcmtmbG93SWQiLCJjb25maWciLCJtb2RlbElkIiwibW9kZWxWZXJzaW9uSWQiLCJib2R5IiwiaWQiLCJub2RlcyIsIm1vZGVsIiwibW9kZWxfdmVyc2lvbiIsInBvc3QiLCJkZWxldGUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQUlDLFdBQVdELFFBQVEsWUFBUixDQUFmOztlQUN5QkEsUUFBUSxhQUFSLEM7SUFBcEJFLEcsWUFBQUEsRztJQUFLQyxXLFlBQUFBLFc7O0lBQ0xDLGMsR0FBa0NGLEcsQ0FBbENFLGM7SUFBZ0JDLGEsR0FBa0JILEcsQ0FBbEJHLGE7O2dCQUNGTCxRQUFRLFNBQVIsQztJQUFkTSxTLGFBQUFBLFM7O2dCQUNjTixRQUFRLFdBQVIsQztJQUFkTyxTLGFBQUFBLFM7O0FBRUw7Ozs7OztJQUlNQyxTO0FBQ0oscUJBQVlDLE9BQVosRUFBbUM7QUFBQTs7QUFBQSxRQUFkQyxPQUFjLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pDLFNBQUtELE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtDLE9BQUwsR0FBZUEsT0FB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QU1ELFNBUE0sQ0FBUDtBQVFELE9BVE0sQ0FBUDtBQVVEOzs7Ozs7QUFFSDs7QUFFQW1CLE9BQU9DLE9BQVAsR0FBaUJuQyxTQUFqQiIsImZpbGUiOiJXb3JrZmxvd3MuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpO1xubGV0IFdvcmtmbG93ID0gcmVxdWlyZSgnLi9Xb3JrZmxvdycpO1xubGV0IHtBUEksIHJlcGxhY2VWYXJzfSA9IHJlcXVpcmUoJy4vY29uc3RhbnRzJyk7XG5sZXQge1dPUktGTE9XU19QQVRILCBXT1JLRkxPV19QQVRILH0gPSBBUEk7XG5sZXQge3dyYXBUb2tlbix9ID0gcmVxdWlyZSgnLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xuXG4vKipcbiAqIGNsYXNzIHJlcHJlc2VudGluZyBhIGNvbGxlY3Rpb24gb2Ygd29ya2Zsb3dzXG4gKiBAY2xhc3NcbiAqL1xuY2xhc3MgV29ya2Zsb3dzIHtcbiAgY29uc3RydWN0b3IoX2NvbmZpZywgcmF3RGF0YSA9IFtdKSB7XG4gICAgdGhpcy5fY29uZmlnID0gX2NvbmZpZztcbiAgICB0aGlzLnJhd0RhdGEgPSByYXdEYXRhO1xuICAgIHJhd0RhdGEuZm9yRWFjaCgod29ya2Zsb3dEYXRhLCBpbmRleCkgPT4ge1xuICAgICAgdGhpc1tpbmRleF0gPSBuZXcgV29ya2Zsb3codGhpcy5fY29uZmlnLCB3b3JrZmxvd0RhdGEpO1xuICAgIH0pO1xuICAgIHRoaXMubGVuZ3RoID0gcmF3RGF0YS5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCB3b3JrZmxvd3MgaW4gYXBwXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAgICBvcHRpb25zICBPYmplY3Qgd2l0aCBrZXlzIGV4cGxhaW5lZCBiZWxvdzogKG9wdGlvbmFsKVxuICAgKiAgIEBwYXJhbSB7TnVtYmVyfSAgICBvcHRpb25zLnBhZ2UgIFRoZSBwYWdlIG51bWJlciAob3B0aW9uYWwsIGRlZmF1bHQ6IDEpXG4gICAqICAgQHBhcmFtIHtOdW1iZXJ9ICAgIG9wdGlvbnMucGVyUGFnZSAgTnVtYmVyIG9mIGltYWdlcyB0byByZXR1cm4gcGVyIHBhZ2UgKG9wdGlvbmFsLCBkZWZhdWx0OiAyMClcbiAgICogQHJldHVybiB7UHJvbWlzZShXb3JrZmxvd3MsIGVycm9yKX0gQSBQcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdpdGggYW4gaW5zdGFuY2Ugb2YgV29ya2Zsb3dzIG9yIHJlamVjdGVkIHdpdGggYW4gZXJyb3JcbiAgICovXG4gIGxpc3Qob3B0aW9ucyA9IHtwYWdlOiAxLCBwZXJQYWdlOiAyMH0pIHtcbiAgICBsZXQgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7V09SS0ZMT1dTX1BBVEh9YDtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF4aW9zLmdldCh1cmwsIHtcbiAgICAgICAgICBoZWFkZXJzLFxuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgcGFnZTogb3B0aW9ucy5wYWdlLFxuICAgICAgICAgICAgcGVyX3BhZ2U6IG9wdGlvbnMucGVyUGFnZSxcbiAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgaWYgKGlzU3VjY2VzcyhyZXNwb25zZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmUobmV3IFdvcmtmbG93cyh0aGlzLl9jb25maWcsIHJlc3BvbnNlLmRhdGEud29ya2Zsb3dzKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCByZWplY3QpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBjcmVhdGUod29ya2Zsb3dJZCwgY29uZmlnKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7V09SS0ZMT1dTX1BBVEh9YDtcbiAgICBjb25zdCBtb2RlbElkID0gY29uZmlnLm1vZGVsSWQ7XG4gICAgY29uc3QgbW9kZWxWZXJzaW9uSWQgPSBjb25maWcubW9kZWxWZXJzaW9uSWQ7XG4gICAgY29uc3QgYm9keSA9IHtcbiAgICAgIHdvcmtmbG93czogW3tcbiAgICAgICAgaWQ6IHdvcmtmbG93SWQsXG4gICAgICAgIG5vZGVzOiBbe1xuICAgICAgICAgIGlkOiAnY29uY2VwdHMnLFxuICAgICAgICAgIG1vZGVsOiB7XG4gICAgICAgICAgICBpZDogbW9kZWxJZCxcbiAgICAgICAgICAgIG1vZGVsX3ZlcnNpb246IHtcbiAgICAgICAgICAgICAgaWQ6IG1vZGVsVmVyc2lvbklkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XVxuICAgICAgfV1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHdyYXBUb2tlbih0aGlzLl9jb25maWcsIChoZWFkZXJzKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBheGlvcy5wb3N0KHVybCwgYm9keSwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgY29uc3Qgd29ya2Zsb3dJZCA9IHJlc3BvbnNlLmRhdGEud29ya2Zsb3dzWzBdLmlkO1xuICAgICAgICAgIHJlc29sdmUod29ya2Zsb3dJZCk7XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh3b3JrZmxvd0lkKSB7XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5fY29uZmlnLmJhc2VQYXRofSR7cmVwbGFjZVZhcnMoV09SS0ZMT1dfUEFUSCwgW3dvcmtmbG93SWRdKX1gO1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgYXhpb3MuZGVsZXRlKHVybCwge1xuICAgICAgICAgIGhlYWRlcnNcbiAgICAgICAgfSkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgfSwgcmVqZWN0KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG47XG5cbm1vZHVsZS5leHBvcnRzID0gV29ya2Zsb3dzO1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/Workflows.js","/")
},{"./Workflow":48,"./constants":50,"./helpers":52,"./utils":55,"axios":4,"buffer":23,"pBGvAp":27}],50:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var MAX_BATCH_SIZE = 128;
var GEO_LIMIT_TYPES = ['withinMiles', 'withinKilometers', 'withinRadians', 'withinDegrees'];
var SYNC_TIMEOUT = 360000; // 6 minutes
var MODEL_QUEUED_FOR_TRAINING = '21103';
var MODEL_TRAINING = '21101';
var POLLTIME = 2000;

module.exports = {
  API: {
    TOKEN_PATH: '/token',
    MODELS_PATH: '/models',
    MODEL_PATH: '/models/$0',
    MODEL_VERSIONS_PATH: '/models/$0/versions',
    MODEL_VERSION_PATH: '/models/$0/versions/$1',
    MODEL_PATCH_PATH: '/models/$0/output_info/data/concepts',
    MODEL_OUTPUT_PATH: '/models/$0/output_info',
    MODEL_SEARCH_PATH: '/models/searches',
    MODEL_FEEDBACK_PATH: '/models/$0/feedback',
    MODEL_VERSION_FEEDBACK_PATH: '/models/$0/versions/$1/feedback',
    PREDICT_PATH: '/models/$0/outputs',
    VERSION_PREDICT_PATH: '/models/$0/versions/$1/outputs',
    CONCEPTS_PATH: '/concepts',
    CONCEPT_PATH: '/concepts/$0',
    CONCEPT_SEARCH_PATH: '/concepts/searches',
    MODEL_INPUTS_PATH: '/models/$0/inputs',
    MODEL_VERSION_INPUTS_PATH: '/models/$0/versions/$1/inputs',
    MODEL_VERSION_METRICS_PATH: '/models/$0/versions/$1/metrics',
    INPUTS_PATH: '/inputs',
    INPUT_PATH: '/inputs/$0',
    INPUTS_STATUS_PATH: '/inputs/status',
    SEARCH_PATH: '/searches',
    WORKFLOWS_PATH: '/workflows',
    WORKFLOW_PATH: '/workflows/$0',
    WORKFLOW_RESULTS_PATH: '/workflows/$0/results'
  },
  ERRORS: {
    paramsRequired: function paramsRequired(param) {
      var paramList = Array.isArray(param) ? param : [param];
      return new Error('The following ' + (paramList.length > 1 ? 'params are' : 'param is') + ' required: ' + paramList.join(', '));
    },
    MAX_INPUTS: new Error('Number of inputs passed exceeded max of ' + MAX_BATCH_SIZE),
    INVALID_GEOLIMIT_TYPE: new Error('Incorrect geo_limit type. Value must be any of the following: ' + GEO_LIMIT_TYPES.join(', ')),
    INVALID_DELETE_ARGS: new Error('Wrong arguments passed. You can only delete all models (provide no arguments), delete select models (provide list of ids),\n    delete a single model (providing a single id) or delete a model version (provide a single id and version id)')
  },
  STATUS: {
    MODEL_QUEUED_FOR_TRAINING: MODEL_QUEUED_FOR_TRAINING,
    MODEL_TRAINING: MODEL_TRAINING
  },
  // var replacement must be given in order
  replaceVars: function replaceVars(path) {
    var vars = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    var newPath = path;
    vars.forEach(function (val, index) {
      if (index === 0) {
        val = encodeURIComponent(val);
      }
      newPath = newPath.replace(new RegExp('\\$' + index, 'g'), val);
    });
    return newPath;
  },
  getBasePath: function getBasePath() {
    var apiEndpoint = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'https://api.clarifai.com';
    var userId = arguments[1];
    var appId = arguments[2];

    if (!userId || !appId) {
      return apiEndpoint + '/v2';
    }
    return apiEndpoint + '/v2/users/' + userId + '/apps/' + appId;
  },
  GEO_LIMIT_TYPES: GEO_LIMIT_TYPES,
  MAX_BATCH_SIZE: MAX_BATCH_SIZE,
  SYNC_TIMEOUT: SYNC_TIMEOUT,
  POLLTIME: POLLTIME
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnN0YW50cy5qcyJdLCJuYW1lcyI6WyJNQVhfQkFUQ0hfU0laRSIsIkdFT19MSU1JVF9UWVBFUyIsIlNZTkNfVElNRU9VVCIsIk1PREVMX1FVRVVFRF9GT1JfVFJBSU5JTkciLCJNT0RFTF9UUkFJTklORyIsIlBPTExUSU1FIiwibW9kdWxlIiwiZXhwb3J0cyIsIkFQSSIsIlRPS0VOX1BBVEgiLCJNT0RFTFNfUEFUSCIsIk1PREVMX1BBVEgiLCJNT0RFTF9WRVJTSU9OU19QQVRIIiwiTU9ERUxfVkVSU0lPTl9QQVRIIiwiTU9ERUxfUEFUQ0hfUEFUSCIsIk1PREVMX09VVFBVVF9QQVRIIiwiTU9ERUxfU0VBUkNIX1BBVEgiLCJNT0RFTF9GRUVEQkFDS19QQVRIIiwiTU9ERUxfVkVSU0lPTl9GRUVEQkFDS19QQVRIIiwiUFJFRElDVF9QQVRIIiwiVkVSU0lPTl9QUkVESUNUX1BBVEgiLCJDT05DRVBUU19QQVRIIiwiQ09OQ0VQVF9QQVRIIiwiQ09OQ0VQVF9TRUFSQ0hfUEFUSCIsIk1PREVMX0lOUFVUU19QQVRIIiwiTU9ERUxfVkVSU0lPTl9JTlBVVFNfUEFUSCIsIk1PREVMX1ZFUlNJT05fTUVUUklDU19QQVRIIiwiSU5QVVRTX1BBVEgiLCJJTlBVVF9QQVRIIiwiSU5QVVRTX1NUQVRVU19QQVRIIiwiU0VBUkNIX1BBVEgiLCJXT1JLRkxPV1NfUEFUSCIsIldPUktGTE9XX1BBVEgiLCJXT1JLRkxPV19SRVNVTFRTX1BBVEgiLCJFUlJPUlMiLCJwYXJhbXNSZXF1aXJlZCIsInBhcmFtIiwicGFyYW1MaXN0IiwiQXJyYXkiLCJpc0FycmF5IiwiRXJyb3IiLCJsZW5ndGgiLCJqb2luIiwiTUFYX0lOUFVUUyIsIklOVkFMSURfR0VPTElNSVRfVFlQRSIsIklOVkFMSURfREVMRVRFX0FSR1MiLCJTVEFUVVMiLCJyZXBsYWNlVmFycyIsInBhdGgiLCJ2YXJzIiwibmV3UGF0aCIsImZvckVhY2giLCJ2YWwiLCJpbmRleCIsImVuY29kZVVSSUNvbXBvbmVudCIs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ZTtBQTZEZkUsNEJBN0RlO0FBOERmRztBQTlEZSxDQUFqQiIsImZpbGUiOiJjb25zdGFudHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBNQVhfQkFUQ0hfU0laRSA9IDEyODtcbmNvbnN0IEdFT19MSU1JVF9UWVBFUyA9IFsnd2l0aGluTWlsZXMnLCAnd2l0aGluS2lsb21ldGVycycsICd3aXRoaW5SYWRpYW5zJywgJ3dpdGhpbkRlZ3JlZXMnXTtcbmNvbnN0IFNZTkNfVElNRU9VVCA9IDM2MDAwMDsgLy8gNiBtaW51dGVzXG5jb25zdCBNT0RFTF9RVUVVRURfRk9SX1RSQUlOSU5HID0gJzIxMTAzJztcbmNvbnN0IE1PREVMX1RSQUlOSU5HID0gJzIxMTAxJztcbmNvbnN0IFBPTExUSU1FID0gMjAwMDtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIEFQSToge1xuICAgIFRPS0VOX1BBVEg6ICcvdG9rZW4nLFxuICAgIE1PREVMU19QQVRIOiAnL21vZGVscycsXG4gICAgTU9ERUxfUEFUSDogJy9tb2RlbHMvJDAnLFxuICAgIE1PREVMX1ZFUlNJT05TX1BBVEg6ICcvbW9kZWxzLyQwL3ZlcnNpb25zJyxcbiAgICBNT0RFTF9WRVJTSU9OX1BBVEg6ICcvbW9kZWxzLyQwL3ZlcnNpb25zLyQxJyxcbiAgICBNT0RFTF9QQVRDSF9QQVRIOiAnL21vZGVscy8kMC9vdXRwdXRfaW5mby9kYXRhL2NvbmNlcHRzJyxcbiAgICBNT0RFTF9PVVRQVVRfUEFUSDogJy9tb2RlbHMvJDAvb3V0cHV0X2luZm8nLFxuICAgIE1PREVMX1NFQVJDSF9QQVRIOiAnL21vZGVscy9zZWFyY2hlcycsXG4gICAgTU9ERUxfRkVFREJBQ0tfUEFUSDogJy9tb2RlbHMvJDAvZmVlZGJhY2snLFxuICAgIE1PREVMX1ZFUlNJT05fRkVFREJBQ0tfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvZmVlZGJhY2snLFxuICAgIFBSRURJQ1RfUEFUSDogJy9tb2RlbHMvJDAvb3V0cHV0cycsXG4gICAgVkVSU0lPTl9QUkVESUNUX1BBVEg6ICcvbW9kZWxzLyQwL3ZlcnNpb25zLyQxL291dHB1dHMnLFxuICAgIENPTkNFUFRTX1BBVEg6ICcvY29uY2VwdHMnLFxuICAgIENPTkNFUFRfUEFUSDogJy9jb25jZXB0cy8kMCcsXG4gICAgQ09OQ0VQVF9TRUFSQ0hfUEFUSDogJy9jb25jZXB0cy9zZWFyY2hlcycsXG4gICAgTU9ERUxfSU5QVVRTX1BBVEg6ICcvbW9kZWxzLyQwL2lucHV0cycsXG4gICAgTU9ERUxfVkVSU0lPTl9JTlBVVFNfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvaW5wdXRzJyxcbiAgICBNT0RFTF9WRVJTSU9OX01FVFJJQ1NfUEFUSDogJy9tb2RlbHMvJDAvdmVyc2lvbnMvJDEvbWV0cmljcycsXG4gICAgSU5QVVRTX1BBVEg6ICcvaW5wdXRzJyxcbiAgICBJTlBVVF9QQVRIOiAnL2lucHV0cy8kMCcsXG4gICAgSU5QVVRTX1NUQVRVU19QQVRIOiAnL2lucHV0cy9zdGF0dXMnLFxuICAgIFNFQVJDSF9QQVRIOiAnL3NlYXJjaGVzJyxcbiAgICBXT1JLRkxPV1NfUEFUSDogJy93b3JrZmxvd3MnLFxuICAgIFdPUktGTE9XX1BBVEg6ICcvd29ya2Zsb3dzLyQwJyxcbiAgICBXT1JLRkxPV19SRVNVTFRTX1BBVEg6ICcvd29ya2Zsb3dzLyQwL3Jlc3VsdHMnXG4gIH0sXG4gIEVSUk9SUzoge1xuICAgIHBhcmFtc1JlcXVpcmVkOiAocGFyYW0pID0+IHtcbiAgICAgIGxldCBwYXJhbUxpc3QgPSBBcnJheS5pc0FycmF5KHBhcmFtKSA/IHBhcmFtIDogW3BhcmFtXTtcbiAgICAgIHJldHVybiBuZXcgRXJyb3IoYFRoZSBmb2xsb3dpbmcgJHtwYXJhbUxpc3QubGVuZ3RoID4gMSA/ICdwYXJhbXMgYXJlJyA6ICdwYXJhbSBpcyd9IHJlcXVpcmVkOiAke3BhcmFtTGlzdC5qb2luKCcsICcpfWApO1xuICAgIH0sXG4gICAgTUFYX0lOUFVUUzogbmV3IEVycm9yKGBOdW1iZXIgb2YgaW5wdXRzIHBhc3NlZCBleGNlZWRlZCBtYXggb2YgJHtNQVhfQkFUQ0hfU0laRX1gKSxcbiAgICBJTlZBTElEX0dFT0xJTUlUX1RZUEU6IG5ldyBFcnJvcihgSW5jb3JyZWN0IGdlb19saW1pdCB0eXBlLiBWYWx1ZSBtdXN0IGJlIGFueSBvZiB0aGUgZm9sbG93aW5nOiAke0dFT19MSU1JVF9UWVBFUy5qb2luKCcsICcpfWApLFxuICAgIElOVkFMSURfREVMRVRFX0FSR1M6IG5ldyBFcnJvcihgV3JvbmcgYXJndW1lbnRzIHBhc3NlZC4gWW91IGNhbiBvbmx5IGRlbGV0ZSBhbGwgbW9kZWxzIChwcm92aWRlIG5vIGFyZ3VtZW50cyksIGRlbGV0ZSBzZWxlY3QgbW9kZWxzIChwcm92aWRlIGxpc3Qgb2YgaWRzKSxcbiAgICBkZWxldGUgYSBzaW5nbGUgbW9kZWwgKHByb3ZpZGluZyBhIHNpbmdsZSBpZCkgb3IgZGVsZXRlIGEgbW9kZWwgdmVyc2lvbiAocHJvdmlkZSBhIHNpbmdsZSBpZCBhbmQgdmVyc2lvbiBpZClgKVxuICB9LFxuICBTVEFUVVM6IHtcbiAgICBNT0RFTF9RVUVVRURfRk9SX1RSQUlOSU5HLFxuICAgIE1PREVMX1RSQUlOSU5HXG4gIH0sXG4gIC8vIHZhciByZXBsYWNlbWVudCBtdXN0IGJlIGdpdmVuIGluIG9yZGVyXG4gIHJlcGxhY2VWYXJzOiAocGF0aCwgdmFycyA9IFtdKSA9PiB7XG4gICAgbGV0IG5ld1BhdGggPSBwYXRoO1xuICAgIHZhcnMuZm9yRWFjaCgodmFsLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgIHZhbCA9IGVuY29kZVVSSUNvbXBvbmVudCh2YWwpO1xuICAgICAgfVxuICAgICAgbmV3UGF0aCA9IG5ld1BhdGgucmVwbGFjZShuZXcgUmVnRXhwKGBcXFxcJCR7aW5kZXh9YCwgJ2cnKSwgdmFsKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3UGF0aDtcbiAgfSxcbiAgZ2V0QmFzZVBhdGg6IChhcGlFbmRwb2ludCA9ICdodHRwczovL2FwaS5jbGFyaWZhaS5jb20nLCB1c2VySWQsIGFwcElkKSA9PiB7XG4gICAgaWYoIXVzZXJJZCB8fCAhYXBwSWQpIHtcbiAgICAgIHJldHVybiBgJHthcGlFbmRwb2ludH0vdjJgO1xuICAgIH1cbiAgICByZXR1cm4gYCR7YXBpRW5kcG9pbnR9L3YyL3VzZXJzLyR7dXNlcklkfS9hcHBzLyR7YXBwSWR9YDtcbiAgfSxcbiAgR0VPX0xJTUlUX1RZUEVTLFxuICBNQVhfQkFUQ0hfU0laRSxcbiAgU1lOQ19USU1FT1VULFxuICBQT0xMVElNRVxufTtcbiJdfQ==
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/constants.js","/")
},{"buffer":23,"pBGvAp":27}],51:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var App = require('./App');

var _require = require('./../package.json'),
    version = _require.version;

module.exports = global.Clarifai = {
  version: version,
  App: App,
  GENERAL_MODEL: 'aaa03c23b3724a16a56b629203edc62c',
  FOOD_MODEL: 'bd367be194cf45149e75f01d59f77ba7',
  TRAVEL_MODEL: 'eee28c313d69466f836ab83287a54ed9',
  NSFW_MODEL: 'e9576d86d2004ed1a38ba0cf39ecb4b1',
  WEDDINGS_MODEL: 'c386b7a870114f4a87477c0824499348',
  WEDDING_MODEL: 'c386b7a870114f4a87477c0824499348',
  COLOR_MODEL: 'eeed0b6733a644cea07cf4c60f87ebb7',
  CLUSTER_MODEL: 'cccbe437d6e54e2bb911c6aa292fb072',
  FACE_DETECT_MODEL: 'a403429f2ddf4b49b307e318f00e528b',
  FOCUS_MODEL: 'c2cf7cecd8a6427da375b9f35fcd2381',
  LOGO_MODEL: 'c443119bf2ed4da98487520d01a0b1e3',
  DEMOGRAPHICS_MODEL: 'c0c0ac362b03416da06ab3fa36fb58e3',
  GENERAL_EMBED_MODEL: 'bbb5f41425b8468d9b7a554ff10f8581',
  FACE_EMBED_MODEL: 'd02b4508df58432fbb84e800597b8959',
  APPAREL_MODEL: 'e0be3b9d6a454f0493ac3a30784001ff',
  MODERATION_MODEL: 'd16f390eb32cad478c7ae150069bd2c6',
  TEXTURES_AND_PATTERNS: 'fbefb47f9fdb410e8ce14f24f54b47ff',
  LANDSCAPE_QUALITY: 'bec14810deb94c40a05f1f0eb3c91403',
  PORTRAIT_QUALITY: 'de9bd05cfdbf4534af151beb2a5d0953'
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZha2VfYjc4NWY2M2UuanMiXSwibmFtZXMiOlsiQXBwIiwicmVxdWlyZSIsInZlcnNpb24iLCJtb2R1bGUiLCJleHBvcnRzIiwiZ2xvYmFsIiwiQ2xhcmlmYWkiLCJHRU5FUkFMX01PREVMIiwiRk9PRF9NT0RFTCIsIlRSQVZFTF9NT0RFTCIsIk5TRldfTU9ERUwiLCJXRURESU5HU19NT0RFTCIsIldFRERJTkdfTU9ERUwiLCJDT0xPUl9NT0RFTCIsIkNMVVNURVJfTU9ERUwiLCJGQUNFX0RFVEVDVF9NT0RFTCIsIkZPQ1VTX01PREVMIiwiTE9HT19NT0RFTCIsIkRFTU9HUkFQSElDU19NT0RFTCIsIkdFTkVSQUxfRU1CRURfTU9ERUwiLCJGQUNFX0VNQkVEX01PREVMIiwiQVBQQVJFTF9NT0RFTCIsIk1PREVSQVRJT05fTU9ERUwiLCJURVhUVVJFU19BTkRfUEFUVEVSTlMiLCJMQU5EU0NBUEVfUVVBTElUWSIsIlBPUlRSQUlUX1FVQUxJVFkiXSwibWFwcGluZ3MiOiI7O0FBQUEsSUFBSUEsTUFBTUMsUUFBUSxPQUFSLENBQVY7O2VBQ2dCQSxRQUFRLG1CQUFSLEM7SUFBWEMsTyxZQUFBQSxPOztBQUVMQyxPQUFPQyxPQUFQLEdBQWlCQyxPQUFPQyxRQUFQLEdBQWtCO0FBQ2pDSixrQkFEaUM7QUFFakNGLFVBRmlDO0FBR2pDTyxpQkFBZSxrQ0FIa0I7QUFJakNDLGNBQVksa0NBSnFCO0FBS2pDQyxnQkFBYyxrQ0FMbUI7QUFNakNDLGNBQVksa0NBTnFCO0FBT2pDQyxrQkFBZ0Isa0NBUGlCO0FBUWpDQyxpQkFBZSxrQ0FSa0I7QUFTakNDLGVBQWEsa0NBVG9CO0FBVWpDQyxpQkFBZSxrQ0FWa0I7QUFXakNDLHFCQUFtQixrQ0FYYztBQVlqQ0MsZUFBYSxrQ0Fab0I7QUFhakNDLGNBQVksa0NBYnFCO0FBY2pDQyxzQkFBb0Isa0NBZGE7QUFlakNDLHVCQUFxQixrQ0FmWTtBQWdCakNDLG9CQUFrQixrQ0FoQmU7QUFpQmpDQyxpQkFBZSxrQ0FqQmtCO0FBa0JqQ0Msb0JBQWtCLGtDQWxCZTtBQW1CakNDLHlCQUF1QixrQ0FuQlU7QUFvQmpDQyxxQkFBbUIsa0NBcEJjO0FBcUJqQ0Msb0JBQWtCO0FBckJlLENBQW5DIiwiZmlsZSI6ImZha2VfYjc4NWY2M2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgQXBwID0gcmVxdWlyZSgnLi9BcHAnKTtcbmxldCB7dmVyc2lvbn0gPSByZXF1aXJlKCcuLy4uL3BhY2thZ2UuanNvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdsb2JhbC5DbGFyaWZhaSA9IHtcbiAgdmVyc2lvbixcbiAgQXBwLFxuICBHRU5FUkFMX01PREVMOiAnYWFhMDNjMjNiMzcyNGExNmE1NmI2MjkyMDNlZGM2MmMnLFxuICBGT09EX01PREVMOiAnYmQzNjdiZTE5NGNmNDUxNDllNzVmMDFkNTlmNzdiYTcnLFxuICBUUkFWRUxfTU9ERUw6ICdlZWUyOGMzMTNkNjk0NjZmODM2YWI4MzI4N2E1NGVkOScsXG4gIE5TRldfTU9ERUw6ICdlOTU3NmQ4NmQyMDA0ZWQxYTM4YmEwY2YzOWVjYjRiMScsXG4gIFdFRERJTkdTX01PREVMOiAnYzM4NmI3YTg3MDExNGY0YTg3NDc3YzA4MjQ0OTkzNDgnLFxuICBXRURESU5HX01PREVMOiAnYzM4NmI3YTg3MDExNGY0YTg3NDc3YzA4MjQ0OTkzNDgnLFxuICBDT0xPUl9NT0RFTDogJ2VlZWQwYjY3MzNhNjQ0Y2VhMDdjZjRjNjBmODdlYmI3JyxcbiAgQ0xVU1RFUl9NT0RFTDogJ2NjY2JlNDM3ZDZlNTRlMmJiOTExYzZhYTI5MmZiMDcyJyxcbiAgRkFDRV9ERVRFQ1RfTU9ERUw6ICdhNDAzNDI5ZjJkZGY0YjQ5YjMwN2UzMThmMDBlNTI4YicsXG4gIEZPQ1VTX01PREVMOiAnYzJjZjdjZWNkOGE2NDI3ZGEzNzViOWYzNWZjZDIzODEnLFxuICBMT0dPX01PREVMOiAnYzQ0MzExOWJmMmVkNGRhOTg0ODc1MjBkMDFhMGIxZTMnLFxuICBERU1PR1JBUEhJQ1NfTU9ERUw6ICdjMGMwYWMzNjJiMDM0MTZkYTA2YWIzZmEzNmZiNThlMycsXG4gIEdFTkVSQUxfRU1CRURfTU9ERUw6ICdiYmI1ZjQxNDI1Yjg0NjhkOWI3YTU1NGZmMTBmODU4MScsXG4gIEZBQ0VfRU1CRURfTU9ERUw6ICdkMDJiNDUwOGRmNTg0MzJmYmI4NGU4MDA1OTdiODk1OScsXG4gIEFQUEFSRUxfTU9ERUw6ICdlMGJlM2I5ZDZhNDU0ZjA0OTNhYzNhMzA3ODQwMDFmZicsXG4gIE1PREVSQVRJT05fTU9ERUw6ICdkMTZmMzkwZWIzMmNhZDQ3OGM3YWUxNTAwNjliZDJjNicsXG4gIFRFWFRVUkVTX0FORF9QQVRURVJOUzogJ2ZiZWZiNDdmOWZkYjQxMGU4Y2UxNGYyNGY1NGI0N2ZmJyxcbiAgTEFORFNDQVBFX1FVQUxJVFk6ICdiZWMxNDgxMGRlYjk0YzQwYTA1ZjFmMGViM2M5MTQwMycsXG4gIFBPUlRSQUlUX1FVQUxJVFk6ICdkZTliZDA1Y2ZkYmY0NTM0YWYxNTFiZWIyYTVkMDk1Mydcbn07XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/fake_b785f63e.js","/")
},{"./../package.json":37,"./App":38,"buffer":23,"pBGvAp":27}],52:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var SUCCESS_CODES = [200, 201];

module.exports = {
  isSuccess: function isSuccess(response) {
    return SUCCESS_CODES.indexOf(response.status) > -1;
  },
  deleteEmpty: function deleteEmpty(obj) {
    var strict = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    Object.keys(obj).forEach(function (key) {
      if (obj[key] === null || obj[key] === undefined || strict === true && (obj[key] === '' || obj[key].length === 0 || Object.keys(obj[key]).length === 0)) {
        delete obj[key];
      }
    });
  },
  clone: function clone(obj) {
    var keys = Object.keys(obj);
    var copy = {};
    keys.forEach(function (k) {
      copy[k] = obj[k];
    });
    return copy;
  },
  checkType: function checkType(regex, val) {
    if (regex instanceof RegExp === false) {
      regex = new RegExp(regex);
    }
    return regex.test(Object.prototype.toString.call(val));
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImhlbHBlcnMuanMiXSwibmFtZXMiOlsiU1VDQ0VTU19DT0RFUyIsIm1vZHVsZSIsImV4cG9ydHMiLCJpc1N1Y2Nlc3MiLCJyZXNwb25zZSIsImluZGV4T2YiLCJzdGF0dXMiLCJkZWxldGVFbXB0eSIsIm9iaiIsInN0cmljdCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwidW5kZWZpbmVkIiwibGVuZ3RoIiwiY2xvbmUiLCJjb3B5IiwiayIsImNoZWNrVHlwZSIsInJlZ2V4IiwidmFsIiwiUmVnRXhwIiwidGVzdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxJQUFNQSxnQkFBZ0IsQ0FBQyxHQUFELEVBQU0sR0FBTixDQUF0Qjs7QUFFQUMsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxhQUFXLG1CQUFDQyxRQUFELEVBQWM7QUFDdkIsV0FBT0osY0FBY0ssT0FBZCxDQUFzQkQsU0FBU0UsTUFBL0IsSUFBeUMsQ0FBQyxDQUFqRDtBQUNELEdBSGM7QUFJZkMsZUFBYSxxQkFBQ0MsR0FBRCxFQUF5QjtBQUFBLFFBQW5CQyxNQUFtQix1RUFBVixLQUFVOztBQUNwQ0MsV0FBT0MsSUFBUCxDQUFZSCxHQUFaLEVBQWlCSSxPQUFqQixDQUF5QixVQUFDQyxHQUFELEVBQVM7QUFDaEMsVUFBSUwsSUFBSUssR0FBSixNQUFhLElBQWIsSUFDRkwsSUFBSUssR0FBSixNQUFhQyxTQURYLElBRUZMLFdBQVcsSUFBWCxLQUNBRCxJQUFJSyxHQUFKLE1BQWEsRUFBYixJQUNBTCxJQUFJSyxHQUFKLEVBQVNFLE1BQVQsS0FBb0IsQ0FEcEIsSUFFQUwsT0FBT0MsSUFBUCxDQUFZSCxJQUFJSyxHQUFKLENBQVosRUFBc0JFLE1BQXRCLEtBQWlDLENBSGpDLENBRkYsRUFLdUM7QUFDckMsZUFBT1AsSUFBSUssR0FBSixDQUFQO0FBQ0Q7QUFDRixLQVREO0FBVUQsR0FmYztBQWdCZkcsU0FBTyxlQUFDUixHQUFELEVBQVM7QUFDZCxRQUFJRyxPQUFPRCxPQUFPQyxJQUFQLENBQVlILEdBQVosQ0FBWDtBQUNBLFFBQUlTLE9BQU8sRUFBWDtBQUNBTixTQUFLQyxPQUFMLENBQWEsVUFBQ00sQ0FBRCxFQUFPO0FBQ2xCRCxXQUFLQyxDQUFMLElBQVVWLElBQUlVLENBQUosQ0FBVjtBQUNELEtBRkQ7QUFHQSxXQUFPRCxJQUFQO0FBQ0QsR0F2QmM7QUF3QmZFLGFBQVcsbUJBQUNDLEtBQUQsRUFBUUMsR0FBUixFQUFnQjtBQUN6QixRQUFLRCxpQkFBaUJFLE1BQWxCLEtBQThCLEtBQWxDLEVBQXlDO0FBQ3ZDRixjQUFRLElBQUlFLE1BQUosQ0FBV0YsS0FBWCxDQUFSO0FBQ0Q7QUFDRCxXQUFPQSxNQUFNRyxJQUFOLENBQVdiLE9BQU9jLFNBQVAsQ0FBaUJDLFFBQWpCLENBQTBCQyxJQUExQixDQUErQkwsR0FBL0IsQ0FBWCxDQUFQO0FBQ0Q7QUE3QmMsQ0FBakIiLCJmaWxlIjoiaGVscGVycy5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFNVQ0NFU1NfQ09ERVMgPSBbMjAwLCAyMDFdO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdWNjZXNzOiAocmVzcG9uc2UpID0+IHtcbiAgICByZXR1cm4gU1VDQ0VTU19DT0RFUy5pbmRleE9mKHJlc3BvbnNlLnN0YXR1cykgPiAtMTtcbiAgfSxcbiAgZGVsZXRlRW1wdHk6IChvYmosIHN0cmljdCA9IGZhbHNlKSA9PiB7XG4gICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmIChvYmpba2V5XSA9PT0gbnVsbCB8fFxuICAgICAgICBvYmpba2V5XSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHN0cmljdCA9PT0gdHJ1ZSAmJiAoXG4gICAgICAgIG9ialtrZXldID09PSAnJyB8fFxuICAgICAgICBvYmpba2V5XS5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgT2JqZWN0LmtleXMob2JqW2tleV0pLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgICAgZGVsZXRlIG9ialtrZXldO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBjbG9uZTogKG9iaikgPT4ge1xuICAgIGxldCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICBsZXQgY29weSA9IHt9O1xuICAgIGtleXMuZm9yRWFjaCgoaykgPT4ge1xuICAgICAgY29weVtrXSA9IG9ialtrXTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29weTtcbiAgfSxcbiAgY2hlY2tUeXBlOiAocmVnZXgsIHZhbCkgPT4ge1xuICAgIGlmICgocmVnZXggaW5zdGFuY2VvZiBSZWdFeHApID09PSBmYWxzZSkge1xuICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlZ2V4LnRlc3QoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbCkpO1xuICB9XG59O1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/helpers.js","/")
},{"buffer":23,"pBGvAp":27}],53:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios');

var _require = require('../utils'),
    wrapToken = _require.wrapToken;

var _require2 = require('../helpers'),
    isSuccess = _require2.isSuccess,
    clone = _require2.clone;

var BASE_URL = 'https://api.clarifai-moderation.com';

var Moderation = function () {
  function Moderation(_config) {
    _classCallCheck(this, Moderation);

    this._config = _config;
  }

  _createClass(Moderation, [{
    key: 'predict',
    value: function predict(modelID, imageURL) {
      return wrapToken(this._config, function (headers) {
        var url = BASE_URL + '/v2/models/' + modelID + '/outputs';
        var params = {
          inputs: [{
            data: {
              image: {
                url: imageURL
              }
            }
          }]
        };

        return new Promise(function (resolve, reject) {
          return axios.post(url, params, { headers: headers }).then(function (response) {
            if (isSuccess(response)) {
              var data = clone(response.data);
              resolve(data);
            } else {
              reject(response);
            }
          }, reject);
        });
      });
    }
  }, {
    key: 'getModerationStatus',
    value: function getModerationStatus(imageID) {
      return wrapToken(this._config, function (headers) {
        var url = BASE_URL + '/v2/inputs/' + imageID + '/outputs';
        return new Promise(function (resolve, reject) {
          return axios.get(url, { headers: headers }).then(function (response) {
            var data = clone(response.data);
            resolve(data);
          }, reject);
        });
      });
    }
  }]);

  return Moderation;
}();

module.exports = Moderation;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIk1vZGVyYXRpb24uanMiXSwibmFtZXMiOlsiYXhpb3MiLCJyZXF1aXJlIiwid3JhcFRva2VuIiwiaXNTdWNjZXNzIiwiY2xvbmUiLCJCQVNFX1VSTCIsIk1vZGVyYXRpb24iLCJfY29uZmlnIiwibW9kZWxJRCIsImltYWdlVVJMIiwiaGVhZGVycyIsInVybCIsInBhcmFtcyIsImlucHV0cyIsImRhdGEiLCJpbWFnZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicG9zdCIsInRoZW4iLCJyZXNwb25zZSIsImltYWdlSUQiLCJnZXQiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxJQUFJQSxRQUFRQyxRQUFRLE9BQVIsQ0FBWjs7ZUFDa0JBLFFBQVEsVUFBUixDO0lBQWJDLFMsWUFBQUEsUzs7Z0JBQ29CRCxRQUFRLFlBQVIsQztJQUFwQkUsUyxhQUFBQSxTO0lBQVdDLEssYUFBQUEsSzs7QUFFaEIsSUFBSUMsV0FBVyxxQ0FBZjs7SUFFTUMsVTtBQUVKLHNCQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFNBQUtBLE9BQUwsR0FBZUEsT0FBZjtBQUVEOzs7OzRCQUVPQyxPLEVBQVNDLFEsRUFBVTtBQUN6QixhQUFPUCxVQUFVLEtBQUtLLE9BQWYsRUFBd0IsVUFBQ0csT0FBRCxFQUFhO0FBQzFDLFlBQUlDLE1BQVNOLFFBQVQsbUJBQStCRyxPQUEvQixhQUFKO0FBQ0EsWUFBSUksU0FBUztBQUNYQyxrQkFBUSxDQUNOO0FBQ0VDLGtCQUFNO0FBQ0pDLHFCQUFPO0FBQ0xKLHFCQUFLRjtBQURBO0FBREg7QUFEUixXQURNO0FBREcsU0FBYjs7QUFZQSxlQUFPLElBQUlPLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsaUJBQU9sQixNQUFNbUIsSUFBTixDQUFXUixHQUFYLEVBQWdCQyxNQUFoQixFQUF3QixFQUFDRixnQkFBRCxFQUF4QixFQUFtQ1UsSUFBbkMsQ0FBd0MsVUFBQ0MsUUFBRCxFQUFjO0FBQzNELGdCQUFJbEIsVUFBVWtCLFFBQVYsQ0FBSixFQUF5QjtBQUN2QixrQkFBSVAsT0FBT1YsTUFBTWlCLFNBQVNQLElBQWYsQ0FBWDtBQUNBRyxzQkFBUUgsSUFBUjtBQUNELGFBSEQsTUFHTztBQUNMSSxxQkFBT0csUUFBUDtBQUNEO0FBQ0YsV0FQTSxFQU9KSCxNQVBJLENBQVA7QUFRRCxTQVRNLENBQVA7QUFVRCxPQXhCTSxDQUFQO0FBeUJEOzs7d0NBRW1CSSxPLEVBQVM7QUFDM0IsYUFBT3BCLFVBQVUsS0FBS0ssT0FBZixFQUF3QixVQUFDRyxPQUFELEVBQWE7QUFDMUMsWUFBSUMsTUFBU04sUUFBVCxtQkFBK0JpQixPQUEvQixhQUFKO0FBQ0EsZUFBTyxJQUFJTixPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDLGlCQUFPbEIsTUFBTXVCLEdBQU4sQ0FBVVosR0FBVixFQUFlLEVBQUNELGdCQUFELEVBQWYsRUFBMEJVLElBQTFCLENBQStCLFVBQUNDLFFBQUQsRUFBYztBQUNsRCxnQkFBSVAsT0FBT1YsTUFBTWlCLFNBQVNQLElBQWYsQ0FBWDtBQUNBRyxvQkFBUUgsSUFBUjtBQUNELFdBSE0sRUFHSkksTUFISSxDQUFQO0FBS0QsU0FOTSxDQUFQO0FBT0QsT0FUTSxDQUFQO0FBVUQ7Ozs7OztBQUdITSxPQUFPQyxPQUFQLEdBQWlCbkIsVUFBakIiLCJmaWxlIjoiTW9kZXJhdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJyk7XG5sZXQge3dyYXBUb2tlbn0gPSByZXF1aXJlKCcuLi91dGlscycpO1xubGV0IHtpc1N1Y2Nlc3MsIGNsb25lfSA9IHJlcXVpcmUoJy4uL2hlbHBlcnMnKTtcblxubGV0IEJBU0VfVVJMID0gJ2h0dHBzOi8vYXBpLmNsYXJpZmFpLW1vZGVyYXRpb24uY29tJztcblxuY2xhc3MgTW9kZXJhdGlvbiB7XG5cbiAgY29uc3RydWN0b3IoX2NvbmZpZykge1xuICAgIHRoaXMuX2NvbmZpZyA9IF9jb25maWc7XG5cbiAgfVxuXG4gIHByZWRpY3QobW9kZWxJRCwgaW1hZ2VVUkwpIHtcbiAgICByZXR1cm4gd3JhcFRva2VuKHRoaXMuX2NvbmZpZywgKGhlYWRlcnMpID0+IHtcbiAgICAgIGxldCB1cmwgPSBgJHtCQVNFX1VSTH0vdjIvbW9kZWxzLyR7bW9kZWxJRH0vb3V0cHV0c2A7XG4gICAgICBsZXQgcGFyYW1zID0ge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGltYWdlOiB7XG4gICAgICAgICAgICAgICAgdXJsOiBpbWFnZVVSTFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gYXhpb3MucG9zdCh1cmwsIHBhcmFtcywge2hlYWRlcnN9KS50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChpc1N1Y2Nlc3MocmVzcG9uc2UpKSB7XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGNsb25lKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHJlamVjdCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldE1vZGVyYXRpb25TdGF0dXMoaW1hZ2VJRCkge1xuICAgIHJldHVybiB3cmFwVG9rZW4odGhpcy5fY29uZmlnLCAoaGVhZGVycykgPT4ge1xuICAgICAgbGV0IHVybCA9IGAke0JBU0VfVVJMfS92Mi9pbnB1dHMvJHtpbWFnZUlEfS9vdXRwdXRzYDtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJldHVybiBheGlvcy5nZXQodXJsLCB7aGVhZGVyc30pLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgbGV0IGRhdGEgPSBjbG9uZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICB9LCByZWplY3QpO1xuXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGVyYXRpb247XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/solutions/Moderation.js","/solutions")
},{"../helpers":52,"../utils":55,"axios":4,"buffer":23,"pBGvAp":27}],54:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Moderation = require('./Moderation');

var Solutions = function Solutions(_config) {
  _classCallCheck(this, Solutions);

  this.moderation = new Moderation(_config);
};

module.exports = Solutions;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlNvbHV0aW9ucy5qcyJdLCJuYW1lcyI6WyJNb2RlcmF0aW9uIiwicmVxdWlyZSIsIlNvbHV0aW9ucyIsIl9jb25maWciLCJtb2RlcmF0aW9uIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLElBQUlBLGFBQWFDLFFBQVEsY0FBUixDQUFqQjs7SUFFTUMsUyxHQUVKLG1CQUFZQyxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLE9BQUtDLFVBQUwsR0FBa0IsSUFBSUosVUFBSixDQUFlRyxPQUFmLENBQWxCO0FBQ0QsQzs7QUFHSEUsT0FBT0MsT0FBUCxHQUFpQkosU0FBakIiLCJmaWxlIjoiU29sdXRpb25zLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IE1vZGVyYXRpb24gPSByZXF1aXJlKCcuL01vZGVyYXRpb24nKTtcblxuY2xhc3MgU29sdXRpb25zIHtcblxuICBjb25zdHJ1Y3RvcihfY29uZmlnKSB7XG4gICAgdGhpcy5tb2RlcmF0aW9uID0gbmV3IE1vZGVyYXRpb24oX2NvbmZpZyk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTb2x1dGlvbnM7XG4iXX0=
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/solutions/Solutions.js","/solutions")
},{"./Moderation":53,"buffer":23,"pBGvAp":27}],55:[function(require,module,exports){
(function (process,global,Buffer,__argument0,__argument1,__argument2,__argument3,__filename,__dirname){
'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Promise = require('promise');
var validUrl = require('valid-url');

var _require = require('./constants'),
    GEO_LIMIT_TYPES = _require.GEO_LIMIT_TYPES,
    ERRORS = _require.ERRORS;

var _require2 = require('./helpers'),
    checkType = _require2.checkType,
    clone = _require2.clone;

var _require3 = require('./../package.json'),
    VERSION = _require3.version;

module.exports = {
  wrapToken: function wrapToken(_config, requestFn) {
    return new Promise(function (resolve, reject) {
      if (_config.apiKey) {
        var headers = {
          Authorization: 'Key ' + _config.apiKey,
          'X-Clarifai-Client': 'js:' + VERSION
        };
        return requestFn(headers).then(resolve, reject);
      }
      if (_config.sessionToken) {
        var _headers = {
          'X-Clarifai-Session-Token': _config.sessionToken,
          'X-Clarifai-Client': 'js:' + VERSION
        };
        return requestFn(_headers).then(resolve, reject);
      }
      _config.token().then(function (token) {
        var headers = {
          Authorization: 'Bearer ' + token.accessToken,
          'X-Clarifai-Client': 'js:' + VERSION
        };
        requestFn(headers).then(resolve, reject);
      }, reject);
    });
  },
  formatModel: function formatModel() {
    var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var formatted = {};
    if (data.id === null || data.id === undefined) {
      throw ERRORS.paramsRequired('Model ID');
    }
    formatted.id = data.id;
    if (data.name) {
      formatted.name = data.name;
    }
    formatted.output_info = {};
    if (data.conceptsMutuallyExclusive !== undefined) {
      formatted.output_info.output_config = formatted.output_info.output_config || {};
      formatted.output_info.output_config.concepts_mutually_exclusive = !!data.conceptsMutuallyExclusive;
    }
    if (data.closedEnvironment !== undefined) {
      formatted.output_info.output_config = formatted.output_info.output_config || {};
      formatted.output_info.output_config.closed_environment = !!data.closedEnvironment;
    }
    if (data.concepts) {
      formatted.output_info.data = {
        concepts: data.concepts.map(module.exports.formatConcept)
      };
    }
    return formatted;
  },
  formatInput: function formatInput(data, includeImage) {
    var input = checkType(/String/, data) ? { url: data } : data;
    var formatted = {
      id: input.id || null,
      data: {}
    };
    if (input.concepts) {
      formatted.data.concepts = input.concepts;
    }
    if (input.metadata) {
      formatted.data.metadata = input.metadata;
    }
    if (input.geo) {
      formatted.data.geo = { geo_point: input.geo };
    }
    if (input.regions) {
      formatted.data.regions = input.regions;
    }
    if (includeImage !== false) {
      formatted.data.image = {
        url: input.url,
        base64: input.base64,
        crop: input.crop
      };
      if (data.allowDuplicateUrl) {
        formatted.data.image.allow_duplicate_url = true;
      }
    }
    return formatted;
  },
  formatMediaPredict: function formatMediaPredict(data) {
    var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'image';

    var media = void 0;
    if (checkType(/String/, data)) {
      if (validUrl.isWebUri(data)) {
        media = {
          url: data
        };
      } else {
        media = {
          base64: data
        };
      }
    } else {
      media = Object.assign({}, data);
    }

    // Users can specify their own id to distinguish batch results
    var id = void 0;
    if (media.id) {
      id = media.id;
      delete media.id;
    }

    var object = {
      data: _defineProperty({}, type, media)
    };

    if (id) {
      object.id = id;
    }

    return object;
  },
  formatImagesSearch: function formatImagesSearch(image) {
    var imageQuery = void 0;
    var input = { input: { data: {} } };
    var formatted = [];
    if (checkType(/String/, image)) {
      imageQuery = { url: image };
    } else {
      imageQuery = image.url || image.base64 ? {
        image: {
          url: image.url,
          base64: image.base64,
          crop: image.crop
        }
      } : {};
    }

    input.input.data = imageQuery;
    if (image.id) {
      input.input.id = image.id;
      input.input.data = { image: {} };
      if (image.crop) {
        input.input.data.image.crop = image.crop;
      }
    }
    if (image.metadata !== undefined) {
      input.input.data.metadata = image.metadata;
    }
    if (image.geo !== undefined) {
      if (checkType(/Array/, image.geo)) {
        input.input.data.geo = {
          geo_box: image.geo.map(function (p) {
            return { geo_point: p };
          })
        };
      } else if (checkType(/Object/, image.geo)) {
        if (GEO_LIMIT_TYPES.indexOf(image.geo.type) === -1) {
          throw ERRORS.INVALID_GEOLIMIT_TYPE;
        }
        input.input.data.geo = {
          geo_point: {
            latitude: image.geo.latitude,
            longitude: image.geo.longitude
          },
          geo_limit: {
            type: image.geo.type,
            value: image.geo.value
          }
        };
      }
    }
    if (image.type !== 'input' && input.input.data.image) {
      if (input.input.data.metadata || input.input.data.geo) {
        var dataCopy = { input: { data: clone(input.input.data) } };
        var imageCopy = { input: { data: clone(input.input.data) } };
        delete dataCopy.input.data.image;
        delete imageCopy.input.data.metadata;
        delete imageCopy.input.data.geo;
        input = [{ output: imageCopy }, dataCopy];
      } else {
        input = [{ output: input }];
      }
    }
    formatted = formatted.concat(input);
    return formatted;
  },
  formatConcept: function formatConcept(concept) {
    var formatted = concept;
    if (checkType(/String/, concept)) {
      formatted = {
        id: concept
      };
    }
    return formatted;
  },
  formatConceptsSearch: function formatConceptsSearch(query) {
    if (checkType(/String/, query)) {
      query = { id: query };
    }
    var v = {};
    var type = query.type === 'input' ? 'input' : 'output';
    delete query.type;
    v[type] = {
      data: {
        concepts: [query]
      }
    };
    return v;
  },
  formatObjectForSnakeCase: function formatObjectForSnakeCase(obj) {
    return Object.keys(obj).reduce(function (o, k) {
      o[k.replace(/([A-Z])/g, function (r) {
        return '_' + r.toLowerCase();
      })] = obj[k];
      return o;
    }, {});
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInV0aWxzLmpzIl0sIm5hbWVzIjpbIlByb21pc2UiLCJyZXF1aXJlIiwidmFsaWRVcmwiLCJHRU9fTElNSVRfVFlQRVMiLCJFUlJPUlMiLCJjaGVja1R5cGUiLCJjbG9uZSIsIlZFUlNJT04iLCJ2ZXJzaW9uIiwibW9kdWxlIiwiZXhwb3J0cyIsIndyYXBUb2tlbiIsIl9jb25maWciLCJyZXF1ZXN0Rm4iLCJyZXNvbHZlIiwicmVqZWN0IiwiYXBpS2V5IiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJ0aGVuIiwic2Vzc2lvblRva2VuIiwidG9rZW4iLCJhY2Nlc3NUb2tlbiIsImZvcm1hdE1vZGVsIiwiZGF0YSIsImZvcm1hdHRlZCIsImlkIiwidW5kZWZpbmVkIiwicGFyYW1zUmVxdWlyZWQiLCJuYW1lIiwib3V0cHV0X2luZm8iLCJjb25jZXB0c011dHVhbGx5RXhjbHVzaXZlIiwib3V0cHV0X2NvbmZpZyIsImNvbmNlcHRzX211dHVhbGx5X2V4Y2x1c2l2ZSIsImNsb3NlZEVudmlyb25tZW50IiwiY2xvc2VkX2Vudmlyb25tZW50IiwiY29uY2VwdHMiLCJtYXAiLCJmb3JtYXRDb25jZXB0IiwiZm9ybWF0SW5wdXQiLCJpbmNsdWRlSW1hZ2UiLCJpbnB1dCIsInVybCIsIm1ldGFkYXRhIiwiZ2VvIiwiZ2VvX3BvaW50IiwicmVnaW9ucyIsImltYWdlIiwiYmFzZTY0IiwiY3JvcCIsImFsbG93RHVwbGljYXRlVXJsIiwiYWxsb3dfZHVwbGljYXRlX3VybCIsImZvcm1hdE1lZGlhUHJlZGljdCIsInR5cGUiLCJtZWRpYSIsImlzV2ViVXJpIiwiT2JqZWN0IiwiYXNzaWduIiwib2JqZWN0IiwiZm9ybWF0SW1hZ2VzU2VhcmNoIiwiaW1hZ2VRdWVyeSIsImdlb19ib3giLCJwIiwiaW5kZXhPZiIsIklOVkFMSURfR0VPTElNSVRfVFlQRSIsImxhdGl0dWRlIiwibG9uZ2l0dWRlIiwiZ2VvX2xpbWl0IiwidmFsdWUiLCJkYXRhQ29weSIsImltYWdlQ29weSIsIm91dHB1dCIsImNvbmNhdCIsImNvbmNlcHQiLCJmb3JtYXRDb25jZXB0c1NlYXJjaCIsInF1ZXJ5IiwidiIsImZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZSIsIm9iaiIsImtleXMiLCJyZWR1Y2UiLCJvIiwiayIsInJlcGxhY2UiLCJyIiwidG9Mb3dlckNhc2UiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxJQUFJQSxVQUFVQyxRQUFRLFNBQVIsQ0FBZDtBQUNBLElBQUlDLFdBQVdELFFBQVEsV0FBUixDQUFmOztlQUNnQ0EsUUFBUSxhQUFSLEM7SUFBM0JFLGUsWUFBQUEsZTtJQUFpQkMsTSxZQUFBQSxNOztnQkFDR0gsUUFBUSxXQUFSLEM7SUFBcEJJLFMsYUFBQUEsUztJQUFXQyxLLGFBQUFBLEs7O2dCQUNTTCxRQUFRLG1CQUFSLEM7SUFBWE0sTyxhQUFUQyxPOztBQUVMQyxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLGFBQVcsbUJBQUNDLE9BQUQsRUFBVUMsU0FBVixFQUF3QjtBQUNqQyxXQUFPLElBQUliLE9BQUosQ0FBWSxVQUFDYyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7QUFDdEMsVUFBSUgsUUFBUUksTUFBWixFQUFvQjtBQUNsQixZQUFJQyxVQUFVO0FBQ1pDLGtDQUFzQk4sUUFBUUksTUFEbEI7QUFFWix1Q0FBMkJUO0FBRmYsU0FBZDtBQUlBLGVBQU9NLFVBQVVJLE9BQVYsRUFBbUJFLElBQW5CLENBQXdCTCxPQUF4QixFQUFpQ0MsTUFBakMsQ0FBUDtBQUNEO0FBQ0QsVUFBSUgsUUFBUVEsWUFBWixFQUEwQjtBQUN4QixZQUFJSCxXQUFVO0FBQ1osc0NBQTRCTCxRQUFRUSxZQUR4QjtBQUVaLHVDQUEyQmI7QUFGZixTQUFkO0FBSUEsZUFBT00sVUFBVUksUUFBVixFQUFtQkUsSUFBbkIsQ0FBd0JMLE9BQXhCLEVBQWlDQyxNQUFqQyxDQUFQO0FBQ0Q7QUFDREgsY0FBUVMsS0FBUixHQUFnQkYsSUFBaEIsQ0FBcUIsVUFBQ0UsS0FBRCxFQUFXO0FBQzlCLFlBQUlKLFVBQVU7QUFDWkMscUNB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O0FBSUQ7QUF0TmMsQ0FBakIiLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgUHJvbWlzZSA9IHJlcXVpcmUoJ3Byb21pc2UnKTtcbmxldCB2YWxpZFVybCA9IHJlcXVpcmUoJ3ZhbGlkLXVybCcpO1xubGV0IHtHRU9fTElNSVRfVFlQRVMsIEVSUk9SU30gPSByZXF1aXJlKCcuL2NvbnN0YW50cycpO1xubGV0IHtjaGVja1R5cGUsIGNsb25lfSA9IHJlcXVpcmUoJy4vaGVscGVycycpO1xubGV0IHt2ZXJzaW9uOiBWRVJTSU9OfSA9IHJlcXVpcmUoJy4vLi4vcGFja2FnZS5qc29uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3cmFwVG9rZW46IChfY29uZmlnLCByZXF1ZXN0Rm4pID0+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgaWYgKF9jb25maWcuYXBpS2V5KSB7XG4gICAgICAgIGxldCBoZWFkZXJzID0ge1xuICAgICAgICAgIEF1dGhvcml6YXRpb246IGBLZXkgJHtfY29uZmlnLmFwaUtleX1gLFxuICAgICAgICAgICdYLUNsYXJpZmFpLUNsaWVudCc6IGBqczoke1ZFUlNJT059YFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcmVxdWVzdEZuKGhlYWRlcnMpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH1cbiAgICAgIGlmIChfY29uZmlnLnNlc3Npb25Ub2tlbikge1xuICAgICAgICBsZXQgaGVhZGVycyA9IHtcbiAgICAgICAgICAnWC1DbGFyaWZhaS1TZXNzaW9uLVRva2VuJzogX2NvbmZpZy5zZXNzaW9uVG9rZW4sXG4gICAgICAgICAgJ1gtQ2xhcmlmYWktQ2xpZW50JzogYGpzOiR7VkVSU0lPTn1gXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiByZXF1ZXN0Rm4oaGVhZGVycykudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuICAgICAgX2NvbmZpZy50b2tlbigpLnRoZW4oKHRva2VuKSA9PiB7XG4gICAgICAgIGxldCBoZWFkZXJzID0ge1xuICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbi5hY2Nlc3NUb2tlbn1gLFxuICAgICAgICAgICdYLUNsYXJpZmFpLUNsaWVudCc6IGBqczoke1ZFUlNJT059YFxuICAgICAgICB9O1xuICAgICAgICByZXF1ZXN0Rm4oaGVhZGVycykudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfSwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfSxcbiAgZm9ybWF0TW9kZWw6IChkYXRhID0ge30pID0+IHtcbiAgICBsZXQgZm9ybWF0dGVkID0ge307XG4gICAgaWYgKGRhdGEuaWQgPT09IG51bGwgfHwgZGF0YS5pZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBFUlJPUlMucGFyYW1zUmVxdWlyZWQoJ01vZGVsIElEJyk7XG4gICAgfVxuICAgIGZvcm1hdHRlZC5pZCA9IGRhdGEuaWQ7XG4gICAgaWYgKGRhdGEubmFtZSkge1xuICAgICAgZm9ybWF0dGVkLm5hbWUgPSBkYXRhLm5hbWU7XG4gICAgfVxuICAgIGZvcm1hdHRlZC5vdXRwdXRfaW5mbyA9IHt9O1xuICAgIGlmIChkYXRhLmNvbmNlcHRzTXV0dWFsbHlFeGNsdXNpdmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLm91dHB1dF9jb25maWcgPSBmb3JtYXR0ZWQub3V0cHV0X2luZm8ub3V0cHV0X2NvbmZpZyB8fCB7fTtcbiAgICAgIGZvcm1hdHRlZC5vdXRwdXRfaW5mby5vdXRwdXRfY29uZmlnLmNvbmNlcHRzX211dHVhbGx5X2V4Y2x1c2l2ZSA9ICEhZGF0YS5jb25jZXB0c011dHVhbGx5RXhjbHVzaXZlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5jbG9zZWRFbnZpcm9ubWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBmb3JtYXR0ZWQub3V0cHV0X2luZm8ub3V0cHV0X2NvbmZpZyA9IGZvcm1hdHRlZC5vdXRwdXRfaW5mby5vdXRwdXRfY29uZmlnIHx8IHt9O1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLm91dHB1dF9jb25maWcuY2xvc2VkX2Vudmlyb25tZW50ID0gISFkYXRhLmNsb3NlZEVudmlyb25tZW50O1xuICAgIH1cbiAgICBpZiAoZGF0YS5jb25jZXB0cykge1xuICAgICAgZm9ybWF0dGVkLm91dHB1dF9pbmZvLmRhdGEgPSB7XG4gICAgICAgIGNvbmNlcHRzOiBkYXRhLmNvbmNlcHRzLm1hcChtb2R1bGUuZXhwb3J0cy5mb3JtYXRDb25jZXB0KVxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZvcm1hdHRlZDtcbiAgfSxcbiAgZm9ybWF0SW5wdXQ6IChkYXRhLCBpbmNsdWRlSW1hZ2UpID0+IHtcbiAgICBsZXQgaW5wdXQgPSBjaGVja1R5cGUoL1N0cmluZy8sIGRhdGEpID9cbiAgICAgIHt1cmw6IGRhdGF9IDpcbiAgICAgIGRhdGE7XG4gICAgbGV0IGZvcm1hdHRlZCA9IHtcbiAgICAgIGlkOiBpbnB1dC5pZCB8fCBudWxsLFxuICAgICAgZGF0YToge31cbiAgICB9O1xuICAgIGlmIChpbnB1dC5jb25jZXB0cykge1xuICAgICAgZm9ybWF0dGVkLmRhdGEuY29uY2VwdHMgPSBpbnB1dC5jb25jZXB0cztcbiAgICB9XG4gICAgaWYgKGlucHV0Lm1ldGFkYXRhKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5tZXRhZGF0YSA9IGlucHV0Lm1ldGFkYXRhO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuZ2VvKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5nZW8gPSB7Z2VvX3BvaW50OiBpbnB1dC5nZW99O1xuICAgIH1cbiAgICBpZiAoaW5wdXQucmVnaW9ucykge1xuICAgICAgZm9ybWF0dGVkLmRhdGEucmVnaW9ucyA9IGlucHV0LnJlZ2lvbnM7XG4gICAgfVxuICAgIGlmIChpbmNsdWRlSW1hZ2UgIT09IGZhbHNlKSB7XG4gICAgICBmb3JtYXR0ZWQuZGF0YS5pbWFnZSA9IHtcbiAgICAgICAgdXJsOiBpbnB1dC51cmwsXG4gICAgICAgIGJhc2U2NDogaW5wdXQuYmFzZTY0LFxuICAgICAgICBjcm9wOiBpbnB1dC5jcm9wXG4gICAgICB9O1xuICAgICAgaWYgKGRhdGEuYWxsb3dEdXBsaWNhdGVVcmwpIHtcbiAgICAgICAgZm9ybWF0dGVkLmRhdGEuaW1hZ2UuYWxsb3dfZHVwbGljYXRlX3VybCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmb3JtYXR0ZWQ7XG4gIH0sXG4gIGZvcm1hdE1lZGlhUHJlZGljdDogKGRhdGEsIHR5cGUgPSAnaW1hZ2UnKSA9PiB7XG4gICAgbGV0IG1lZGlhO1xuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGRhdGEpKSB7XG4gICAgICBpZiAodmFsaWRVcmwuaXNXZWJVcmkoZGF0YSkpIHtcbiAgICAgICAgbWVkaWEgPSB7XG4gICAgICAgICAgdXJsOiBkYXRhXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZWRpYSA9IHtcbiAgICAgICAgICBiYXNlNjQ6IGRhdGFcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbWVkaWEgPSBPYmplY3QuYXNzaWduKHt9LCBkYXRhKTtcbiAgICB9XG5cbiAgICAvLyBVc2VycyBjYW4gc3BlY2lmeSB0aGVpciBvd24gaWQgdG8gZGlzdGluZ3Vpc2ggYmF0Y2ggcmVzdWx0c1xuICAgIGxldCBpZDtcbiAgICBpZiAobWVkaWEuaWQpIHtcbiAgICAgIGlkID0gbWVkaWEuaWQ7XG4gICAgICBkZWxldGUgbWVkaWEuaWQ7XG4gICAgfVxuXG4gICAgbGV0IG9iamVjdCA9IHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgW3R5cGVdOiBtZWRpYVxuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoaWQpIHtcbiAgICAgIG9iamVjdC5pZCA9IGlkO1xuICAgIH1cblxuICAgIHJldHVybiBvYmplY3Q7XG4gIH0sXG4gIGZvcm1hdEltYWdlc1NlYXJjaDogKGltYWdlKSA9PiB7XG4gICAgbGV0IGltYWdlUXVlcnk7XG4gICAgbGV0IGlucHV0ID0ge2lucHV0OiB7ZGF0YToge319fTtcbiAgICBsZXQgZm9ybWF0dGVkID0gW107XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgaW1hZ2UpKSB7XG4gICAgICBpbWFnZVF1ZXJ5ID0ge3VybDogaW1hZ2V9O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbWFnZVF1ZXJ5ID0gKGltYWdlLnVybCB8fCBpbWFnZS5iYXNlNjQpID8ge1xuICAgICAgICBpbWFnZToge1xuICAgICAgICAgIHVybDogaW1hZ2UudXJsLFxuICAgICAgICAgIGJhc2U2NDogaW1hZ2UuYmFzZTY0LFxuICAgICAgICAgIGNyb3A6IGltYWdlLmNyb3BcbiAgICAgICAgfVxuICAgICAgfSA6IHt9O1xuICAgIH1cblxuICAgIGlucHV0LmlucHV0LmRhdGEgPSBpbWFnZVF1ZXJ5O1xuICAgIGlmIChpbWFnZS5pZCkge1xuICAgICAgaW5wdXQuaW5wdXQuaWQgPSBpbWFnZS5pZDtcbiAgICAgIGlucHV0LmlucHV0LmRhdGEgPSB7aW1hZ2U6IHt9fTtcbiAgICAgIGlmKGltYWdlLmNyb3ApIHtcbiAgICAgICAgaW5wdXQuaW5wdXQuZGF0YS5pbWFnZS5jcm9wID0gaW1hZ2UuY3JvcDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGltYWdlLm1ldGFkYXRhICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlucHV0LmlucHV0LmRhdGEubWV0YWRhdGEgPSBpbWFnZS5tZXRhZGF0YTtcbiAgICB9XG4gICAgaWYgKGltYWdlLmdlbyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2hlY2tUeXBlKC9BcnJheS8sIGltYWdlLmdlbykpIHtcbiAgICAgICAgaW5wdXQuaW5wdXQuZGF0YS5nZW8gPSB7XG4gICAgICAgICAgZ2VvX2JveDogaW1hZ2UuZ2VvLm1hcChwID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7Z2VvX3BvaW50OiBwfTtcbiAgICAgICAgICB9KVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmIChjaGVja1R5cGUoL09iamVjdC8sIGltYWdlLmdlbykpIHtcbiAgICAgICAgaWYgKEdFT19MSU1JVF9UWVBFUy5pbmRleE9mKGltYWdlLmdlby50eXBlKSA9PT0gLTEpIHtcbiAgICAgICAgICB0aHJvdyBFUlJPUlMuSU5WQUxJRF9HRU9MSU1JVF9UWVBFO1xuICAgICAgICB9XG4gICAgICAgIGlucHV0LmlucHV0LmRhdGEuZ2VvID0ge1xuICAgICAgICAgIGdlb19wb2ludDoge1xuICAgICAgICAgICAgbGF0aXR1ZGU6IGltYWdlLmdlby5sYXRpdHVkZSxcbiAgICAgICAgICAgIGxvbmdpdHVkZTogaW1hZ2UuZ2VvLmxvbmdpdHVkZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgZ2VvX2xpbWl0OiB7XG4gICAgICAgICAgICB0eXBlOiBpbWFnZS5nZW8udHlwZSxcbiAgICAgICAgICAgIHZhbHVlOiBpbWFnZS5nZW8udmFsdWVcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpbWFnZS50eXBlICE9PSAnaW5wdXQnICYmIGlucHV0LmlucHV0LmRhdGEuaW1hZ2UpIHtcbiAgICAgIGlmIChpbnB1dC5pbnB1dC5kYXRhLm1ldGFkYXRhIHx8IGlucHV0LmlucHV0LmRhdGEuZ2VvKSB7XG4gICAgICAgIGxldCBkYXRhQ29weSA9IHtpbnB1dDoge2RhdGE6IGNsb25lKGlucHV0LmlucHV0LmRhdGEpfX07XG4gICAgICAgIGxldCBpbWFnZUNvcHkgPSB7aW5wdXQ6IHtkYXRhOiBjbG9uZShpbnB1dC5pbnB1dC5kYXRhKX19O1xuICAgICAgICBkZWxldGUgZGF0YUNvcHkuaW5wdXQuZGF0YS5pbWFnZTtcbiAgICAgICAgZGVsZXRlIGltYWdlQ29weS5pbnB1dC5kYXRhLm1ldGFkYXRhO1xuICAgICAgICBkZWxldGUgaW1hZ2VDb3B5LmlucHV0LmRhdGEuZ2VvO1xuICAgICAgICBpbnB1dCA9IFtcbiAgICAgICAgICB7b3V0cHV0OiBpbWFnZUNvcHl9LFxuICAgICAgICAgIGRhdGFDb3B5XG4gICAgICAgIF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnB1dCA9IFt7b3V0cHV0OiBpbnB1dH1dO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3JtYXR0ZWQgPSBmb3JtYXR0ZWQuY29uY2F0KGlucHV0KTtcbiAgICByZXR1cm4gZm9ybWF0dGVkO1xuICB9LFxuICBmb3JtYXRDb25jZXB0OiAoY29uY2VwdCkgPT4ge1xuICAgIGxldCBmb3JtYXR0ZWQgPSBjb25jZXB0O1xuICAgIGlmIChjaGVja1R5cGUoL1N0cmluZy8sIGNvbmNlcHQpKSB7XG4gICAgICBmb3JtYXR0ZWQgPSB7XG4gICAgICAgIGlkOiBjb25jZXB0XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gZm9ybWF0dGVkO1xuICB9LFxuICBmb3JtYXRDb25jZXB0c1NlYXJjaDogKHF1ZXJ5KSA9PiB7XG4gICAgaWYgKGNoZWNrVHlwZSgvU3RyaW5nLywgcXVlcnkpKSB7XG4gICAgICBxdWVyeSA9IHtpZDogcXVlcnl9O1xuICAgIH1cbiAgICBsZXQgdiA9IHt9O1xuICAgIGxldCB0eXBlID0gcXVlcnkudHlwZSA9PT0gJ2lucHV0JyA/ICdpbnB1dCcgOiAnb3V0cHV0JztcbiAgICBkZWxldGUgcXVlcnkudHlwZTtcbiAgICB2W3R5cGVdID0ge1xuICAgICAgZGF0YToge1xuICAgICAgICBjb25jZXB0czogW3F1ZXJ5XVxuICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHY7XG4gIH0sXG4gIGZvcm1hdE9iamVjdEZvclNuYWtlQ2FzZShvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5yZWR1Y2UoKG8sIGspID0+IHtcbiAgICAgIG9bay5yZXBsYWNlKC8oW0EtWl0pL2csIHIgPT4gJ18nK3IudG9Mb3dlckNhc2UoKSldID0gb2JqW2tdO1xuICAgICAgcmV0dXJuIG87XG4gICAgfSwge30pO1xuICB9XG59O1xuIl19
}).call(this,require("pBGvAp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer,arguments[3],arguments[4],arguments[5],arguments[6],"/utils.js","/")
},{"./../package.json":37,"./constants":50,"./helpers":52,"buffer":23,"pBGvAp":27,"promise":28,"valid-url":36}]},{},[51])