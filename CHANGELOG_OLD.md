# Older changes
## 1.5.5 (2024-08-19)

- Dependency updates.
- Raise minimum required js-controller version to 5.0.19.
- Raise minimum required node version to 18.
- Fix minor issues reported by the ioBroker adapter bot (https://github.com/ylabonte/ioBroker.procon-ip/issues/102).

## 1.5.4 (2024-02-27)

- Fix the last issues that were reported by the ioBroker adapter checker.  
  (Includes a minor optimization in implementation.)
- Update [procon-ip package](https://github.com/ylabonte/procon-ip) to the
  latest version.

## 1.5.3 (2024-02-27)

- Update dependencies.

## 1.5.2 (2024-02-13)

- Add newline before descriptive text in adapter config.
- Update dependencies.

## 1.5.1 (2023-09-05)

- Re-translate adapter config.
- Cleanup adapter code.
- Update dependencies.

## 1.5.0 (2023-08-31)

- Breaking backward compatibility: For older installations, this update may
  require an adapter reconfiguration.
- Require `js-controller >=3.0.0`: Remove support for obsolete credential
  encryption mechanisms (in favor to ioBroker's native encryption mechanism).
- Require `iobroker.admin >=5.0.0`: Replace old-fashioned materialize admin
  interface with a newer JSON defined one.

## 1.4.0 (2023-08-21)

- Add generic relay timers
  (relays must be set to 'auto' for the timer to function).
- Update dependencies.

## 1.3.3 (2023-07-13)

- Update dependencies.

## 1.3.2 (2023-07-10)

- Update dependencies.
- Adapter Icon change.

## 1.3.1 (2023-06-12)

- re-add read-only restrictions on `onOff` states of dosage control relays.
- Add writable numeric `dosage` states to trigger timer-based manual dosage.

## 1.3.0 (2023-06-11)

- Remove restrictions on dosage control relays: enable manual switching.
- Add additional boolean states for dosage control information:
  `info.system.chlorineDosageEnabled`, `info.system.phPlusDosageEnabled`,
  `info.system.phMinusDosageEnabled`, `info.system.electrolysis` (formerly
  only available as combined bit-state/integer value
  `info.system.dosageControl` as delivered by the GetState.csv).
- Update dependencies.

## 1.2.3 (2023-04-29)

- Update dependencies.

## 1.2.2 (2023-01-08)

- Update dependencies.

## 1.2.1 (2022-03-28)

- Fix connection problem (see [related issue](https://github.com/ylabonte/ioBroker.procon-ip/issues/29)).

## 1.2.0 (2022-03-07)

- Update `procon-ip` API library package to v1.3.2  
  (should fix a bug that let the relay switching fail).
- Fix minor issues that occur with invalid controller URLs.
- Update further dependencies.

## 1.1.1 (2021-09-05)

- Move API library sources into a [separate package](https://www.npmjs.com/package/procon-ip).
- Update `common.name` attributes when the corresponding label changes.
- Update dependencies.

## 1.0.2 (2020-09-05)

- Fine tune the polling and control requests
  (add additional adapter settings for this).
- Wait a configurable amount of consecutive errors, before raising the log
  level to _Warning_ for polling requests.
- Try to send control commands two more times, if an error occurs on the
  request.

## 1.0.1 (2020-08-16)

- Fix Object State updates.
  For some reason the two js objects used to compare the before and after
  values of the GetState.csv calls became the same object (before was
  referencing the new values). That caused the adapter to never update the
  object states.

## 1.0.0 (2020-08-15)

- Official release in ioBroker adapter repository:  
  The most exciting change with this release is, that it's available from the
  ioBroker adapter repository. Hence you can just install it, without copy/
  pasting the github repo url of this adapter!
- Fix all open [milestone issues](https://github.com/ylabonte/ioBroker.procon-ip/milestone/1)
  especially regarding the ones resulted from the [adapter review](https://github.com/ioBroker/ioBroker.repositories/pull/756#issuecomment-646988248)).
- Add/Extend documentation
  (see [wiki](https://github.com/ylabonte/ioBroker.procon-ip/wiki)).  
  Now it's up to you to extend the wiki or request me using issues to extend
  the wiki or README.md regarding a specific content.

## 0.4.1 (2020-05-29)

- Fix write actions to the appropriate states of external relays.  
  _This will add auto-recognition on whether the external relays are activated
  or not and therefore decide on how to handle write actions to the
  corresponding relay state._

## 0.4.0 (2020-05-10)

- Add encryption for configuration settings stored in ioBroker's internal db.
- Improve http request/connection error handling.
- Reduce logging output.
- Remove the unused admin tab.

## 0.3.1 (2020-05-04)

- Update dependencies including some reported as vulnerable.
- Add connection status indication for iobroker's instance tab.
- Add form validation for the configuration settings.

## 0.2.0 (2020-02-09)

- Update npm dependencies.
- Group admin settings input fields in rows.

## 0.1.1 (2019-09-12)

- Update vulnerable eslint-utils.

## 0.1.0 (2019-07-21)

- Fix object attributes regarding the cloud adapter.
- Pre-defined `smartName` attributes for active relays and temperature
  sensors.
- Recognize relays with 'light', 'licht' or 'leucht' in its name as
  `smartType` _LIGHT_.

## 0.0.4 (2019-07-17)

- Update `lodash` (pinning version `4.17.14`).
- Update other indirect and direct dependencies.

## 0.0.3 (2019-07-16)

- Fix missing `value` states.
- Reduce logging output.

## 0.0.2 (2019-07-09)

- Fix sys info state values.

## 0.0.1 (2019-07-09)

- All information from `GetState.csv` as readonly states.
- Writable states for all relays to toggle auto/manual.
- Writable states for relays not configured for dosage control to toggle
  on/off.
