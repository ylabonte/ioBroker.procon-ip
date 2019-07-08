![Logo](admin/iobroker-procon-ip.png)
# ioBroker.procon-ip

[![NPM version](http://img.shields.io/npm/v/iobroker.procon-ip.svg)](https://www.npmjs.com/package/iobroker.procon-ip)
[![Downloads](https://img.shields.io/npm/dm/iobroker.procon-ip.svg)](https://www.npmjs.com/package/iobroker.procon-ip)
[![Dependency Status](https://img.shields.io/david/ylabonte/iobroker.procon-ip.svg)](https://david-dm.org/ylabonte/iobroker.procon-ip)
[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip)
[![Travis-CI](http://img.shields.io/travis/ylabonte/ioBroker.procon-ip/master.svg)](https://travis-ci.org/ylabonte/ioBroker.procon-ip)

[![NPM](https://nodei.co/npm/iobroker.procon-ip.png?downloads=true)](https://nodei.co/npm/iobroker.procon-ip/)


## ProCon.IP pool control adapter for ioBroker
ioBroker adapter for basic support of the ProCon.IP pool control unit. It is intended for integration with your voice 
assistant (eg. via the `cloud` adapter for Alexa or `yahka` for Apple HomeKit with Siri).

Further documentation and german translation will follow, when the adapter really implements its major functionality and
therefore becomes some kind of 'production ready'. 😉

## Changelog

### 0.0.1
* initial release with following features:
  * All information from `GetState.csv` as readonly states
  * Writable states for all relays to toggle auto/manual
  * Writable states for relays not configured for dosage control to toggle on/off 

## Development
This adapter is based on the [TypeScript adapter template](https://github.com/ioBroker/ioBroker.template/tree/master/TypeScript).


## License
MIT License

Copyright (c) 2019 Yannic Labonte <yannic.labonte@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
