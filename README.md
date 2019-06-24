![Logo](admin/iobroker-procon-ip.png)
# ioBroker.procon-ip

<!--[![NPM version](http://img.shields.io/npm/v/iobroker.template.svg)](https://www.npmjs.com/package/iobroker.template)-->
<!--[![Downloads](https://img.shields.io/npm/dm/iobroker.template.svg)](https://www.npmjs.com/package/iobroker.template)-->
<!--[![Dependency Status](https://img.shields.io/david/Author/iobroker.template.svg)](https://david-dm.org/Author/iobroker.template)-->
<!--[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip)-->

<!--[![NPM](https://nodei.co/npm/iobroker.template.png?downloads=true)](https://nodei.co/npm/iobroker.template/)-->

**Tests:**: [![Travis-CI](http://img.shields.io/travis/ylabonte/ioBroker.procon-ip/master.svg)](https://travis-ci.org/ylabonte/ioBroker.procon-ip)

## ProCon.IP pool control adapter for ioBroker

Adapter for basic support of the ProCon.IP pool control. Intended for integration with your voice assistant (eg. via 
the `cloud` adapter for Alexa or `yahka` for Apple HomeKit with Siri).

### Test the adapter manually on a local ioBroker installation

In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
	```bash
	npm pack
	```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
	```bash
	cd /opt/iobroker
	npm i /path/to/tarball.tgz
	```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.template`)
1. Execute `iobroker upload template` on the ioBroker host

## Changelog

### 0.0.1
* initial release

## License
MIT License

Copyright (c) 2019 Author

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
