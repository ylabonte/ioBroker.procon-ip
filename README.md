![Logo](admin/iobroker-procon-ip.png)
# ioBroker.procon-ip

[![NPM version](http://img.shields.io/npm/v/iobroker.procon-ip.svg)](https://www.npmjs.com/package/iobroker.procon-ip)
[![Downloads](https://img.shields.io/npm/dm/iobroker.procon-ip.svg)](https://www.npmjs.com/package/iobroker.procon-ip)
[![Dependency Status](https://img.shields.io/david/ylabonte/iobroker.procon-ip.svg)](https://david-dm.org/ylabonte/iobroker.procon-ip)
[![Known Vulnerabilities](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip/badge.svg)](https://snyk.io/test/github/ylabonte/ioBroker.procon-ip)
[![Travis-CI](http://img.shields.io/travis/ylabonte/ioBroker.procon-ip/master.svg)](https://travis-ci.org/ylabonte/ioBroker.procon-ip)

[![NPM](https://nodei.co/npm/iobroker.procon-ip.png?downloads=true)](https://nodei.co/npm/iobroker.procon-ip/)


## ProCon.IP pool control adapter for ioBroker
ioBroker adapter for basic support of the ProCon.IP pool control unit. It is intended for integration with your favorit voice assistant(s) (eg. via the [`cloud`](https://github.com/ioBroker/ioBroker.cloud) or [`IoT`](https://github.com/ioBroker/ioBroker.iot) adapter for Alexa or [`yahka`](https://github.com/jensweigele/ioBroker.yahka) for Apple HomeKit with Siri) and/or further smart home integration and automation (eg. via individual scripts using ioBroker's javascript adapter).


### What is the ProCon.IP pool control?
![Picture from pooldigital.de](https://www.pooldigital.de/shop/media/image/66/47/a5/ProConIP1_720x600.png)

The ProCon.IP pool control is a low budget network attached control unit for home swimming pools. With its software switched relays, it can control multiple pumps (for the pool filter and different dosage aspects) either simply planned per time schedule or depending on a reading/value from one of its many input channels for measurements (eg. i/o flow sensors, Dallas 1-Wire termometers, redox and pH electrodes). At least there is also the option to switch these relays on demand, which makes them also applicable for switching lights (or anything else you want) on/off.
Not all of its functionality is reachable via API. In fact there is one documented API for reading (polling) values as CSV (`/GetState.csv`). In my memories there was another one for switching the relays on/off and on with timer. But I cannot find the second one anymore. So not even pretty, but functional: The ProCon.IP has two native web interfaces, which can be analyzed, to some kind of reverse engineer a given functionality (like switching the relays).

For more information see the following link (sorry it's only in german; haven't found an english documentation/information so far):
* [pooldigital.de webshop](https://www.pooldigital.de/shop/poolsteuerungen/procon.ip/35/procon.ip-webbasierte-poolsteuerung-/-dosieranlage)
* [pooldigital.de forum](http://forum.pooldigital.de/)

**Just to be clear: I have nothing to do with the development, sellings, marketing or support of the pool control unit. I just developed a solution to integrate such with ioBroker to make my parent's home a bit smarter.**


### Details on the adapter
The adapter uses the `/GetState.csv` API of the ProCon.IP to poll its values and another - not documented - API, that operates with bitwise commands to switch the relays. The second one is also used by the original web interfaces of the ProCon.IP. So there might be future firmware upgrades, that brake compatibilty with this adapter or at least it functionality of switching the relays. 

#### Compatiblity
For now the adapter has been tested and developed in combination with the ProCon.IP firmware **revision 1.7.0.c**.


## Roadmap

### 1.0.0
A full featured release:
* Add documentation (make the github wiki useful/helpful)
* Show connection status including last refresh timestamp and sys info of the ProCon.IP in tab view (can be activated by activating the corresponding menu entry in the admin adapter)
* Automated tests regarding the functionality of the adapter (eg. unit tests)


## Changelog

### 0.3.0
Functional and security update:
* Update dependencies including some reported as vulnerable
* Add connection status indication for iobroker's instance tab
* Add form validation for the configuration settings

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
Security update:
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


## Development and participation
Feel free to contact me, if you wish to participate in development or documentation of this adapter.

Useful links for the approach will be
* the [TypeScript adapter template](https://github.com/ioBroker/ioBroker.template/tree/master/TypeScript) I had started from and
* the [guide for adapter developers](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md).


---
Copyright (c) 2020 Yannic Labonte <yannic.labonte@gmail.com>