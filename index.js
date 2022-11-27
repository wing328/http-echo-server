#!/usr/bin/env node
'use strict'

var getPort = require('get-port')
var server = require('net').createServer()

var cid = 0

module.exports = server // for testing

onEmit(server, { ignore: ['connection', 'listening', 'error'] }, function (eventName) {
  console.log('[server] event:', eventName)
})

server.on('connection', function (c) {
  var gotData = false
  var _cid = ++cid
  var firstLine = true
  var echoMode = false // echo back the HTTP request body
  var foundHttpRequestBody = false

  console.log('[server] event: connection (socket#%d)', _cid)

  onEmit(c, { ignore: ['lookup', 'error'] }, function (eventName) {
    console.log('[socket#%d] event:', _cid, eventName)
  })

  c.on('lookup', function (err, address, family) {
    if (err) {
      console.log('[socket#%d] event: lookup (error: %s)', _cid, err.message)
    } else {
      console.log('[socket#%d] event: lookup (address: %s, family: %s)', _cid, address, family)
    }
  })

  c.on('data', function (chunk) {
    if (firstLine) {
      // e.g. POST /data HTTP/1.1
      var firstLineItems = chunk.toString().split(' ')
      if (firstLineItems[1].startsWith('/echo/')) {
        console.debug('Echo mode switched on for this request')
        echoMode = true
      }

      // console.debug('First line found: ' + chunk.toString().split('\n').join('\n--> '))
      firstLine = false
    }

    console.log('--> ' + chunk.toString().split('\n').join('\n--> '))
    if (!gotData && !echoMode) { // starts the reply e.g. headers, etc
      gotData = true
      c.write('HTTP/1.1 200 OK\r\n')
      c.write('Date: ' + (new Date()).toString() + '\r\n')
      c.write('Connection: close\r\n')
      c.write('Content-Type: text/plain\r\n')
      c.write('Access-Control-Allow-Origin: *\r\n')
      c.write('\r\n')
      setTimeout(function () {
        c.end()
      }, 2000)
    }

    if (echoMode) {
      var lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (/^content-type/i.test(line)) {
          var contentType = line.split(' ')[1]
          console.debug('Found the content-type: ' + line.split(' ')[1])
          if (!gotData) {
            gotData = true
            c.write('HTTP/1.1 200 OK\r\n')
            c.write('Date: ' + (new Date()).toString() + '\r\n')
            c.write('Connection: close\r\n')
            c.write('Content-Type: ' + contentType + '\r\n')
            c.write('Access-Control-Allow-Origin: *\r\n')
            c.write('\r\n')
            setTimeout(function () {
              c.end()
            }, 2000)
          }
        }

        if (line.localeCompare('\r') === 0) { // a blank line
          foundHttpRequestBody = true
          console.debug('Found the blank line before the response body')
          continue
        } else {
          // console.debug("blank line not match: [" + line + "]")
        }
        if (foundHttpRequestBody) {
          c.write(line)
        }
      }
      // console.debug("End of echo mode")
    } else {
      c.write(chunk.toString())
      // c.write("DONE")
    }
  })

  c.on('error', function (err) {
    console.log('[socket#%d] event: error (msg: %s)', _cid, err.message)
  })
})

server.on('listening', function () {
  var port = server.address().port
  console.log('[server] event: listening ...... (port: %d)', port)
})

server.on('error', function (err) {
  console.log('[server] event: error (msg: %s)', err.message)
})

var port = process.argv[2] || process.env.PORT

if (port) {
  server.listen(port)
} else {
  getPort({ port: 3000 }).then(function (port) {
    server.listen(port)
  })
}

function onEmit (emitter, opts, cb) {
  var emitFn = emitter.emit
  emitter.emit = function (eventName) {
    if (opts.ignore.indexOf(eventName) === -1) cb.apply(null, arguments)
    return emitFn.apply(emitter, arguments)
  }
}
