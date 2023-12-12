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
  var binaryMode = false // binary mode
  var binaryModeUrl = "" // binary mode URL
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
      } else if (firstLineItems[1].startsWith('/binary/')) {
        console.debug('Binary mode switched on for this request')
        binaryMode = true
        binaryModeUrl = firstLineItems[1]
      }

      // console.debug('First line found: ' + chunk.toString().split('\n').join('\n--> '))
      firstLine = false
    }

    console.log('--> ' + chunk.toString().split('\n').join('\n--> '))
    if (!gotData && !echoMode && !binaryMode) { // starts the reply e.g. headers, etc
      gotData = true
      c.write('HTTP/1.1 200 OK\n')
      c.write('Date: ' + (new Date()).toString() + '\n')
      c.write('Connection: close\n')
      c.write('Content-Type: text/plain\n')
      c.write('Access-Control-Allow-Origin: *\n')
      c.write('\n')
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
            c.write('HTTP/1.1 200 OK\n')
            c.write('Date: ' + (new Date()).toString() + '\n')
            c.write('Connection: close\n')
            c.write('Content-Type: ' + contentType + '\n')
            c.write('Access-Control-Allow-Origin: *\n')
            c.write('\n')
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
          //console.debug('<-- ' + line);
          c.write(line)
        }
      }
      // console.debug("End of echo mode")
    } else if (binaryMode) {
        if (binaryModeUrl === "/binary/gif") {
            var b64string = 'R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
            var buf = Buffer.from(b64string, 'base64');
            c.write('HTTP/1.1 200 OK\n')
            c.write('Date: ' + (new Date()).toString() + '\n')
            c.write('Connection: close\n')
            c.write('Content-Type: image/gif\n')
            c.write('Access-Control-Allow-Origin: *\n')
            c.write('\n')
            c.write(buf)
            setTimeout(function () {
                c.end()
            }, 2000)
        } else {
            // not yet support other binary type:
            console.log('[socket#%d] event: error (msg: %s)', _cid, "only image/gif supported at the moment")
        }
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
