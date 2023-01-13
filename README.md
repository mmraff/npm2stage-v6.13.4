# @offliner/npm2stage-v6.13.4
CLI to manage [**npm-two-stage**](https://github.com/mmraff/npm-two-stage "Learn why you might want this!") installation for npm 6.13.4

## Installation
```
$ npm install -g @offliner/npm2stage-v6.13.4
```

## Usage
The installed npm that is to be the target of this tool's commands must be of the targeted version. If it doesn't match, the tool will tell you so, and it will not operate on it.

In these examples, the OS is Windows, the tool is used in a git bash console, and the target location is the typical global installation location. However, the tool (and [**npm-two-stage**](https://github.com/mmraff/npm-two-stage "Learn why you might want this!")) are platform-agnostic, and the target npm installation can be anywhere, including on a removeable drive.
```
$ npm2stage status /c/Program\ Files/nodejs/node_modules/npm

    Checking npm version at given path...
    Target npm home is C:\Program Files\nodejs\node_modules\npm
    No backups present.
    No standard files missing.
    No new files present.
    npm-two-stage is not installed at this location.

```
At this point, it's appropriate to run `npm2stage install`.
```
$ npm2stage install /c/Program\ Files/nodejs/node_modules/npm

   Checking npm version at given path...
   Target npm home is C:\Program Files\nodejs\node_modules\npm
   Backing up files to be replaced: C:\Program Files\nodejs\node_modules\npm\lib\fetch-package-metadata.js, C:\Program Files\nodejs\node_modules\npm\lib\install.js, C:\Program Files\nodejs\node_modules\npm\lib\config\cmd-list.js, C:\Program Files\nodejs\node_modules\npm\lib\install\action\refresh-package-json.js ...
   Copying into target directory: fetch-package-metadata.js, install.js, config\cmd-list.js, install\action\refresh-package-json.js, download.js, git-offline.js, offliner.js, prepare-raw-module.js, download ...

   Installation of npm-two-stage was successful.

```
At this point, `npm download` or `npm install --offline` is ready to use.

# 

```
$ npm2stage status /c/Program\ Files/nodejs/node_modules/npm

   Checking npm version at given path...
   Target npm home is C:\Program Files\nodejs\node_modules\npm
   All backups present.
   No standard files missing.
   All expected new files present.
   npm-two-stage is fully installed at this location.

```
At this point, you may run `npm2stage uninstall` (if you must).
```
$ npm2stage uninstall /c/Program\ Files/nodejs/node_modules/npm

   Checking npm version at given path...
   Target npm home is C:\Program Files\nodejs\node_modules\npm
   Removing items added by npm-two-stage install...
   Restoring backed-up original files...
    
   Removal of npm-two-stage was successful.

```

#

For the `install` and `uninstall` commands, there are the abbreviations that the power-user of npm will be familiar with: `i` and `un`. Also for these two commands, there is the `--silent` option to mute output unless there is an error.

For help:
```
$ npm2stage help
```
...or specifically for a command:
```
$ npm2stage install -h
```
