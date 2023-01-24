const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const accessAsync = promisify(fs.access)
const copyFileAsync = promisify(fs.copyFile)
const mkdirAsync = promisify(fs.mkdir)
const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)
const execAsync = promisify(require('child_process').exec)

const rimrafAsync = promisify(require('rimraf'))
const { expect } = require('chai')

const testTools = require('../lib/tools')
const {
  targets: TGTS,
  backupFlag: BAKFLAG,
  errorCodes: ERRS
} = require('../../lib/constants')

const assetsRootName = 'n2s_cli'
const assets = {
  root: path.join(__dirname, assetsRootName),
  get emptyDir () { return path.join(this.root, 'EMPTY_DIR') },
  get scratchDir () { return path.join(this.root, 'MUTABLE_DIR') },
  get npmDir () { return path.join(this.root, 'npm') },
  get npmLibDir () { return path.join(this.root, 'npm/lib') }
}

const srcOffset = 'node_modules/npm-two-stage'
const realSrcDir = path.resolve(
  __dirname, '../../node_modules/npm-two-stage/src'
)
const wrongVersionPJFile = path.resolve(
  __dirname, '../fixtures/npm-wrong-version-package.json'
)
const cliPath = path.resolve(__dirname, '../../cli.js')

const getDidNotReject = () => new Error('Failed to get expected rejection')

const runCLI = (argList, opts) => {
  if (!argList) argList = []
  if (!opts) opts = { env: {} }
  if (!opts.env) opts.env = {}
  // On Windows, PATH is in process.env, but gets inherited automatically;
  // process.env.SHELL is undefined, but child_process uses cmd.exe by default
  // (can't set that to '/usr/bin/bash', because Windows doesn't know that path)
  if (process.platform != 'win32') {
    opts.env.PATH = process.env.PATH
    opts.env.SHELL = process.env.SHELL
  }
  return execAsync([ 'node', cliPath ].concat(argList).join(' '), opts)
  // resolves to { stdout, stderr };
  // rejects as error E with E.stdout and E.stderr
}

const getEntryStates = basePath => {
  const result = {}
  const checkEntries = (wanted, i) => {
    if (i >= wanted.length) return Promise.resolve()
    let f = wanted[i]
    if (wanted === TGTS.CHANGED_FILES) f += BAKFLAG + '.js'
    else if (wanted !== TGTS.ADDED_DIRS) f += '.js'
    const fPath = path.join(basePath, f)
    return accessAsync(fPath).then(() => { result[f] = true })
    .catch(err => { result[f] = false })
    .then(() => checkEntries(wanted, i + 1))
  }
  return checkEntries(TGTS.CHANGED_FILES, 0)
  .then(() => checkEntries([ ...TGTS.CHANGED_FILES ], 0))
  .then(() => checkEntries(TGTS.ADDED_FILES, 0))
  .then(() => checkEntries(TGTS.ADDED_DIRS, 0))
  .then(() => result)
}

describe('command line script', function() {

  before('set up test directory', () =>
    rimrafAsync(assets.root)
    .then(() => mkdirAsync(assets.root))
    .then(() => testTools.copyFreshMockNpmDir(assets.root))
    .then(() => mkdirAsync(assets.emptyDir))
    .then(() => mkdirAsync(assets.scratchDir))
  )

  after('remove temporary assets', () =>
    rimrafAsync(assets.root)
  )

  describe('usage help output', function() {
    const RE_GEN_USAGE = /^Usage: npm2stage <command>/

    it('should display usage help text and exit with error when no args given', () =>
      runCLI().then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(1)
        expect(err.stdout).to.match(RE_GEN_USAGE)
      })
    )

    it('should display usage help text when -h is given', () =>
      runCLI([ '-h' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_GEN_USAGE)
        expect(stderr).to.be.empty
      })
    )

    it('should display general usage help when "help" command is given alone', () =>
      runCLI([ 'help' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_GEN_USAGE)
        expect(stderr).to.be.empty
      })
    )

    const RE_INSTALL_USAGE = /^Usage: npm2stage install|i \[options\] <npmPath>/

    it('should display install-specific help when "help install" is given', () =>
      runCLI([ 'help', 'install' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_INSTALL_USAGE)
        expect(stderr).to.be.empty
      })
    )

    it('should display install-specific help when install command is used with -h', () =>
      runCLI([ 'install', '-h' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_INSTALL_USAGE)
        expect(stderr).to.be.empty
      })
    )

    const RE_STATUS_USAGE = /^Usage: npm2stage status \[options\] <npmPath>/

    it('should display status-specific help when "help status" is given', () =>
      runCLI([ 'help', 'status' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_STATUS_USAGE)
        expect(stderr).to.be.empty
      })
    )

    it('should display status-specific help when status command is used with -h', () =>
      runCLI([ 'status', '-h' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_STATUS_USAGE)
        expect(stderr).to.be.empty
      })
    )

    const RE_UNINST_USAGE = /^Usage: npm2stage uninstall|un \[options\] <npmPath>/

    it('should display uninstall-specific help when "help uninstall" is given', () =>
      runCLI([ 'help', 'uninstall' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_UNINST_USAGE)
        expect(stderr).to.be.empty
      })
    )

    it('should display uninstall-specific help when uninstall command is used with -h', () =>
      runCLI([ 'uninstall', '-h' ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_UNINST_USAGE)
        expect(stderr).to.be.empty
      })
    )
  })

  const STATUS_NO_NPM = [
    '',
    '   Checking npm version at given path...',
    '   npm not found at given location.',
    ''
  ].join('\n')
  const STATUS_WRONG_VER = [
    '',
    '   Checking npm version at given path...',
    '   Wrong version of npm for this version of npm-two-stage.',
    ''
  ].join('\n')

  describe('status command, anomalous cases', function() {
    it('should report no npm when given a path with no package.json', () =>
      runCLI([ 'status', assets.emptyDir ])
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: ENOENT: no such file or directory/)
      })
    )

    it('should report no npm when given a path to a package that is not npm', () =>
      copyFileAsync(
        path.resolve(__dirname, '../fixtures/dummy/package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'status', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: package at .+ is not npm\n$/)
      })
    )

    it('should report bad npm installation when package.json cannot be parsed', () =>
      writeFileAsync(
        path.join(assets.scratchDir, 'package.json'),
        String.fromCharCode(0xFEFF) + "I'm just not the file you want me to be."
      )
      .then(() => runCLI([ 'status', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string([
          '',
          '   Checking npm version at given path...',
          '   failed to parse package.json at '
        ].join('\n'))
        expect(err.stderr).to.match(/^ERROR: failed to parse package.json at /)
      })
    )

    it('should correctly report when given a path to wrong version of npm', () =>
      copyFileAsync(
        wrongVersionPJFile, path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'status', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.WRONG_NPM_VER)
        expect(err.stdout).to.equal(STATUS_WRONG_VER)
        expect(err.stderr).to.match(/^ERROR: wrong version of npm: found /)
      })
    )

    it('should correctly report when given npm path has no lib directory', () =>
      copyFileAsync(
        path.join(assets.npmDir, 'package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'status', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        const msg = 'Unable to access lib directory at supposed npm path\n'
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string(msg)
        expect(err.stderr).to.equal('ERROR: ' + msg)
      })
    )

    // TODO: decide if it's worth it to add here tests of cases
    // * 'Incomplete set of backups present.'
    // * 'Some standard files are missing.'
    // * 'Some expected new files are missing.'
    // These are all covered by the unit test of status.js.
  })

  describe('install command, anomalous cases', function() {
    // In each of these, we verify that no changes are made to the target
    // (or any changes were reversed)

    it('should fail and report no npm when given a path with no package.json', () =>
      runCLI([ 'install', assets.emptyDir ])
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: ENOENT: no such file or directory/)
      })
      .then(() => getEntryStates(assets.emptyDir)).then(states => {
        for (const f in states) expect(states[f]).to.be.false
      })
    )

    it('should fail and report no npm when given a path to a package that is not npm', () =>
      copyFileAsync(
        path.resolve(__dirname, '../fixtures/dummy/package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'install', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: package at .+ is not npm\n$/)
      })
      .then(() => getEntryStates(assets.scratchDir)).then(states => {
        for (const f in states) expect(states[f]).to.be.false
      })
    )

    it('should fail and report bad npm installation when package.json cannot be parsed', () =>
      writeFileAsync(
        path.join(assets.scratchDir, 'package.json'),
        String.fromCharCode(0xFEFF) + '{{{block "block-name"}}}'
      )
      .then(() => runCLI([ 'install', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string([
          '',
          '   Checking npm version at given path...',
          '   failed to parse package.json at '
        ].join('\n'))
        expect(err.stderr).to.match(/^ERROR: failed to parse package.json at /)
      })
      .then(() => getEntryStates(assets.scratchDir)).then(states => {
        for (const f in states) expect(states[f]).to.be.false
      })
    )

    it('should fail and report when given a path to wrong version of npm', () =>
      copyFileAsync(
        wrongVersionPJFile, path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'install', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.WRONG_NPM_VER)
        expect(err.stdout).to.equal(STATUS_WRONG_VER)
        expect(err.stderr).to.match(/^ERROR: wrong version of npm: found /)
      })
      .then(() => getEntryStates(assets.scratchDir)).then(states => {
        for (const f in states) expect(states[f]).to.be.false
      })
    )

    it('should fail and report when given npm path has no lib directory', () =>
      copyFileAsync(
        path.join(assets.npmDir, 'package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'install', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
//console.log('$$$ case: no lib dir:', err)
        const msg = 'Unable to access lib directory at supposed npm path\n'
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string(msg)
        expect(err.stderr).to.equal('ERROR: ' + msg)
      })
      .then(() => getEntryStates(assets.scratchDir)).then(states => {
        for (const f in states) expect(states[f]).to.be.false
      })
    )

    // This one hits restoreOldFiles() (inside changeToBackupNames()), so it
    // gets more coverage than the previous test, but it doesn't get far enough
    // to trigger doCleanup(). To do that, we would have to dynamically make
    // changes to the src directory of npm-two-stage; but that's unacceptably
    // risky.
    it('should fail and report when pointed at an npm installation that is missing a file', () => {
      const brokenNpmDir = path.join(assets.scratchDir, 'npm')
      const expectedErrMsg = 'ENOENT: no such file or directory, rename '
      return rimrafAsync(brokenNpmDir)
      .then(() => testTools.copyFreshMockNpmDir(assets.scratchDir))
      .then(() => unlinkAsync(path.join(brokenNpmDir, 'lib/install.js')))
      .then(() => runCLI([ 'install', brokenNpmDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.match(new RegExp([
          '   Backing up files to be replaced: [^\\n]+',
          '   Error while renaming files; restoring original names...',
          '   ' + expectedErrMsg
        ].join('\n')))
        expect(err.stderr).to.have.string(expectedErrMsg)
      })
    })
  })

  describe('uninstall command, anomalous cases', function() {
    // In each of these, we verify that no changes are made to the target
    // (or any changes were reversed)

    it('should fail and report no npm when given a path with no package.json', () =>
      runCLI([ 'uninstall', assets.emptyDir ])
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: ENOENT: no such file or directory/)
      })
    )

    it('should fail and report no npm when given a path to a package that is not npm', () =>
      copyFileAsync(
        path.resolve(__dirname, '../fixtures/dummy/package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'uninstall', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.NO_NPM)
        expect(err.stdout).to.equal(STATUS_NO_NPM)
        expect(err.stderr).to.match(/^ERROR: package at .+ is not npm\n$/)
      })
    )

    it('should fail and report bad npm installation when package.json cannot be parsed', () =>
      writeFileAsync(
        path.join(assets.scratchDir, 'package.json'), '{ *&^%$#@!? }'
      )
      .then(() => runCLI([ 'uninstall', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string([
          '',
          '   Checking npm version at given path...',
          '   failed to parse package.json at '
        ].join('\n'))
        expect(err.stderr).to.match(/^ERROR: failed to parse package.json at /)
      })
    )

    it('should fail and report when given a path to wrong version of npm', () =>
      copyFileAsync(
        wrongVersionPJFile, path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'uninstall', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.WRONG_NPM_VER)
        expect(err.stdout).to.equal(STATUS_WRONG_VER)
        expect(err.stderr).to.match(/^ERROR: wrong version of npm: found /)
      })
    )

    it('should fail and report when given npm path has no lib directory', () =>
      copyFileAsync(
        path.join(assets.npmDir, 'package.json'),
        path.join(assets.scratchDir, 'package.json')
      )
      .then(() => runCLI([ 'uninstall', assets.scratchDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        const msg = 'Unable to access lib directory at supposed npm path\n'
        expect(err.code).to.equal(ERRS.BAD_NPM_INST)
        expect(err.stdout).to.have.string(msg)
        expect(err.stderr).to.equal('ERROR: ' + msg)
      })
    )

    it('should fail and report when pointed at an npm installation with no npm-two-stage', () => {
      const unchangedNpmDir = path.join(assets.scratchDir, 'npm')
      return rimrafAsync(unchangedNpmDir)
      .then(() => testTools.copyFreshMockNpmDir(assets.scratchDir))
      .then(() => runCLI([ 'uninstall', unchangedNpmDir ]))
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.FS_ACTION_FAIL)
        expect(err.stdout).to.match(new RegExp([
          '   Removing items added by npm-two-stage install...',
          '   Could not find file [^ ]+ for removal'
        ].join('\n')))
        expect(err.stdout).to.have.string(
          '   Restoring backed-up original files...\n   Unable to restore '
        )
        expect(err.stderr).to.have.string('ENOENT: no such file or directory, rename ')
      })
    })
  })

  const STATUS_NOT_INST = [
    '   No backups present.',
    '   No standard files missing.',
    '   No new files present.',
    '   npm-two-stage is not installed at this location.'
  ].join('\n')

  const RE_INSTALL_GOOD = new RegExp([
    '   Backing up files to be replaced: [^\\n]+',
    '   Copying into target directory: [^\\n]+',
    '',
    '   Installation of npm-two-stage was successful.'
  ].join('\n'))

  const STATUS_INSTALLED = [
    '   All backups present.',
    '   No standard files missing.',
    '   All expected new files present.',
    '   npm-two-stage is fully installed at this location.'
  ].join('\n')

  describe('normal command sequence', function() {
    it('should report status of not installed when target is untouched npm', () =>
      runCLI([ 'status', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout).to.have.string(STATUS_NOT_INST)
        expect(stderr).to.be.empty
      })
    )

    it('should succeed when install command used on untouched npm', () =>
      runCLI([ 'install', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout).to.match(RE_INSTALL_GOOD)
        expect(stderr).to.be.empty
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) expect(states[f]).to.be.true
        })
      })
    )

    it('should report status of installed after successful installation', () =>
      runCLI([ 'status', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout).to.have.string(STATUS_INSTALLED)
        expect(stderr).to.be.empty
      })
    )

    const INSTALL_ABORT = [
      '   The remains of a previous installation of npm-two-stage were found.',
      '   This complicates the current installation, so it will be aborted.',
      '   The best action to take now is to run `npm2stage uninstall` using the',
      '   same npm-two-stage version as when the previous installation was run.'
    ].join('\n')

    it('should refuse to install over existing npm-two-stage installation', () =>
      runCLI([ 'install', assets.npmDir ])
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.LEFTOVERS)
        expect(err.stderr).to.have.string(INSTALL_ABORT)
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) expect(states[f]).to.be.true
        })
      })
    )

    it('like previous test, but only error output, given --silent option', () =>
      runCLI([ 'install --silent', assets.npmDir ])
      .then(() => { throw getDidNotReject() })
      .catch(err => {
        expect(err.code).to.equal(ERRS.LEFTOVERS)
        expect(err.stderr).to.match(new RegExp(
          'ERROR: evidence of previous npm-two-stage installation \\([^)]+\\) in target location'
        ))
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) expect(states[f]).to.be.true
        })
      })
    )

    const UNINSTALL_GOOD = [
      '   Removing items added by npm-two-stage install...',
      '   Restoring backed-up original files...',
      '',
      '   Removal of npm-two-stage was successful.'
    ].join('\n')

    it('should succeed when uninstall command used on existing npm-two-stage installation', () =>
      runCLI([ 'uninstall', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout).to.have.string(UNINSTALL_GOOD)
        expect(stderr).to.be.empty
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) {
            if (TGTS.CHANGED_FILES.includes(f.slice(0,-3)))
              expect(states[f]).to.be.true
            else expect(states[f]).to.be.false
          }
        })
      })
    )

    it('should report status of not installed after successful uninstall at target', () =>
      runCLI([ 'status', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout).to.have.string(STATUS_NOT_INST)
        expect(stderr).to.be.empty
      })
    )

    it('should succeed with no console output when install --silent', () =>
      runCLI([ 'install --silent', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout.trim()).to.be.empty
        expect(stderr).to.be.empty
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) expect(states[f]).to.be.true
        })
      })
    )

    it('should succeed with no console output when uninstall --silent', () =>
      runCLI([ 'uninstall --silent', assets.npmDir ]).then(({ stdout, stderr }) => {
        expect(stdout.trim()).to.be.empty
        expect(stderr).to.be.empty
        return getEntryStates(assets.npmLibDir).then(states => {
          for (const f in states) {
            if (TGTS.CHANGED_FILES.includes(f.slice(0,-3)))
              expect(states[f]).to.be.true
            else expect(states[f]).to.be.false
          }
        })
      })
    )
  })
})
/*
  NOTES
  * Some of the uncovered lines of cli.js are the ones where process.exitCode
    gets set to 1 in the absence of an error exitcode; the others are where
    option --silent is handled <--- ADD TESTS FOR THIS!
  * The last 2 uncovered lines for uninstall.js have to do with the case of
    no path given, which means operate on the global npm.
    Can't get coverage of these unless we set the prefix in the call to runCLI;
    but then there would have to be a fully functional npm there!
*/
/*
  TODO:
  * How to get the npmrc for this to exclude lib/file-tools required by test/lib/tools.js?
  * Try `useSpawnWrap: true` in the config?
    [https://stackoverflow.com/questions/50459872/no-coverage-nyc-mocha]
*/