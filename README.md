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


## Roadmap

### 1.0.0 (next planned release)
Full featured release:
* Add documentation (basic installation and setup instructions)
* Show sys info in tab view (can be activated by activating the corresponding menu entry in the admin adapter)
* Add proper connectivity indication for adapter overview
* Add connectivity status in tab view


## Changelog

### 0.3.0
Security and functional update:
* Update dependencies including some reported as vulnerable
* Add connection status indication for iobroker's instance tab

### 0.2.0
Minor update:
* Update npm dependencies
* Group admin settings input fields in rows

### 0.1.1
Security update:
* Update vulnerable eslint-utils

### 0.1.0
Functional update and minor fixes:
* Fix object attributes regarding the cloud adapter
* Optimization for the cloud adapter
    * Pre-defined `smartName` attributes for active relays and temperature sensors
    * Recognize relays with 'light', 'licht' or 'leucht' in its name as `smartType` _LIGHT_ 

### 0.0.4
Security release:
* Update `lodash` (pinning version `4.17.14`)
* Update other indirect and direct dependencies

### 0.0.3
Bugfix release:
* Fix missing `value` states
* Reduce logging output

### 0.0.2
Bugfix release:
* Fix sys info state values

### 0.0.1
Initial release with following features:
* All information from `GetState.csv` as readonly states
* Writable states for all relays to toggle auto/manual
* Writable states for relays not configured for dosage control to toggle on/off 


## Development
Feel free to contact me, if you wish to participate in development or documentation of this adapter.

Useful links for the approach will be
* the [TypeScript adapter template](https://github.com/ioBroker/ioBroker.template/tree/master/TypeScript) I had started from and
* the [guide for adapter developers](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md).


---
Copyright (c) 2020 Yannic Labonte <yannic.labonte@gmail.com>