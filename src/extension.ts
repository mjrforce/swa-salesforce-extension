/* eslint-disable no-useless-escape */
/* eslint-disable semi */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { TextEncoder } from 'util';
import * as utils from './extutils';
import * as vscode from 'vscode';
import { Metadata } from './metadata';
const xml2js = require('xml2js');
const merge = require('deepmerge');
const workingwithpath = require('path');
const outputChannel = vscode.window.createOutputChannel('SWA');
const homedir = require('os').homedir();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const trash = require('trash');
const _home = workingwithpath.resolve(`${homedir}/.swa/source`);

export async function packageDeploy (uris: Array<vscode.Uri>, dryrun: boolean) {
  const wspaces = utils.getRootPath();
  if (wspaces) {
    const wspath = wspaces.fsPath;
    deployManifest(uris, dryrun, wspath);
  }
}

function packageRetrieve (uris: Array<vscode.Uri>) {
  outputChannel.show();
  const wspaces = utils.getRootPath();

  if (wspaces) {
    const wspath = wspaces.fsPath;
    const _manis = workingwithpath.resolve(_home + '/manifest');
    const _packagexml = _manis + '\\deployPackage.xml';
    const _wspackagexml = _manis + '\\wsPackage.xml';
    vscode.workspace.fs.createDirectory(utils.getUri(_home + '/force-app')).then(async function () {
      return vscode.workspace.fs.copy(utils.getUri(wspath + '/sfdx-project.json'), utils.getUri(_home + '/sfdx-project.json'), { overwrite: true });
    }).then(function () {
      return vscode.workspace.fs.copy(utils.getUri(wspath + '/.sfdx'), utils.getUri(_home + '/.sfdx'), { overwrite: true });
    }).then(function () {
      return vscode.workspace.fs.copy(utils.getUri(wspath + '/.sf'), utils.getUri(_home + '/.sf'), { overwrite: true });
    }).then(function () {
      outputChannel.appendLine('SWA: Merging Package Files...');
      return packageMerge(uris, _packagexml);
    }).then(function () {
      outputChannel.appendLine('SWA: Converting XML to JSON...');
      return Promise.all(utils.convertToJSON([utils.getUri(_packagexml)]));
    }).then(function (values) {
      outputChannel.appendLine('SWA: Building Retrieve Manifest...');
      return utils.buildManifest(values, utils.getUri(_packagexml), utils.getUri(_wspackagexml));
    }).then(function (manis) {
      outputChannel.appendLine('SWA: Starting Retrieve...');
      var retrievecmd = 'sf project retrieve start --manifest ' + _packagexml;
      const _options = { cwd: _home };
      return exec(retrievecmd, _options).then(function () { return manis; });
    }).then(function (manis) {
      var retrievecmd = 'sf project retrieve start --manifest ' + _wspackagexml;
      return exec(retrievecmd).then(function () { return manis; });
    }).then(function (manis) {
      outputChannel.appendLine('SWA: Merging Retrieved Metadata...');
      return mergeMetadataForRetrieve(manis[2].result, wspath);
    }).then(function () {
      trash(_home);
    // return convertSource([utils.getUri(_packagexml)]);
    });
  }
}

function mergeMetadataForRetrieve (manifest: any, wspath: string) {
  console.log('get type map: ');
  console.log(manifest);
  var typemap = utils.getTypeMap(manifest);
  console.log(JSON.stringify(typemap));
  var mmap = utils.getMetadataMap(typemap, wspath, true);
  console.log(JSON.stringify(mmap));
  var keys = [...mmap.keys()];
  console.log(keys);
  var promises : any[] = [];
  for (var i = 0; i < keys.length; i++) {
    var value = mmap.get(keys[i]);
    promises.push(new Promise(function (resolve, reject) {
      Promise.all(value).then(function (files) {
        for (var i = 0; i < files.length; i++) {
          var m = new Metadata(files[i][0].result, typemap);
          var val = m.merge(files[i][1].result);
          var builder = new xml2js.Builder();
          var xml = builder.buildObject(val);
          resolve(vscode.workspace.fs.writeFile(utils.getUri(files[i][1].fileName), new TextEncoder().encode(xml)));
        }
      });
    }));
  }
  return Promise.all(promises).then(function () { outputChannel.appendLine('SWA: All Done!'); });
}

function deployManifest (uris: Array<vscode.Uri>, dryrun: boolean, wspath: string) {
  const _packagemanifest = _home + '/manifest/deploymanifest.xml';
  outputChannel.show();
  outputChannel.appendLine('SWA: Merging Manifest Files...')
  packageMerge(uris, _packagemanifest)
    .then(function () {
      outputChannel.appendLine('SWA: Converting XML to JSON...');
      var manifests : any[] = utils.convertToJSON([utils.getUri(_packagemanifest)]);
      return Promise.all(manifests);
    }).then(function (manijsons: any[]) {
      var typemap = utils.getTypeMap(manijsons[0].result);
      var mmap = utils.getMetadataMap(typemap, wspath, false);
      var keys = [...mmap.keys()];
      var promises : any[] = [];
      outputChannel.appendLine('SWA: Creating Delta Files...');
      for (var i = 0; i < keys.length; i++) {
        console.log('key: ' + keys[i] + ' value: ' + mmap.get(keys[i]).length);
        var value = mmap.get(keys[i]);
        promises.push(new Promise(function (resolve, reject) {
          Promise.all(value).then(function (files) {
            for (var i = 0; i < files.length; i++) {
              console.log('files at i:' + i);
              console.log(files[i]);
              var m = new Metadata(files[i][0].result, typemap);
              var filename = files[i][0].fileName;
              var val = m.filter();
              var builder = new xml2js.Builder();
              var xml = builder.buildObject(val);
              resolve(vscode.workspace.fs.rename(utils.getUri(filename), utils.getUri(filename + '.temp'))
                .then(function () {
                  console.log(filename);
                  return vscode.workspace.fs.writeFile(utils.getUri(filename), new TextEncoder().encode(xml))
                    .then(function () {
                      return filename;
                    });
                }));
            }
          });
        }));
      }
      return Promise.all(promises);
    }).then(function (files) {
      var deploycmd = 'sf project deploy start --manifest ' + _packagemanifest;
      if (dryrun) {
        deploycmd += ' --dry-run';
        outputChannel.appendLine('SWA: Validating Metadata against the org...');
      } else {
        outputChannel.appendLine('SWA: Deploying Metadata...');
      }
      return exec(deploycmd).then(function () { return files });
    }).then(function (files) {
      outputChannel.appendLine('SWA: Cleaning things up...');
      console.log('delete files');
      console.log(files);
      files.forEach(function (file:any) {
        console.log('delete: ' + file);
        /*
        vscode.workspace.fs.delete(utils.getUri(file)).then(function () {
          console.log('rename from temp to --> ' + file);
          vscode.workspace.fs.rename(utils.getUri(file + '.temp'), utils.getUri(file));
          outputChannel.appendLine('SWA: All Done...');
        });
        */
      });
    });
}

export async function convertSource (uris: Array<vscode.Uri>) {
  for (let i = 0; i < uris.length; i++) {
    exec('sf project convert source --output-dir mdapi --manifest ' + uris[i]);
  }
}

export function packageMerge (uris: Array<vscode.Uri>, savePath: string) {
  if (uris.length === 1 && utils.isEqual(uris[0].fsPath, savePath)) {
    return new Promise(function (resolve, reject) { resolve(savePath); });
  } else {
    var arr = utils.convertToJSON(uris);
    const _manifest = workingwithpath.normalize(savePath);
    const fileUri = vscode.Uri.file(_manifest);
    return Promise.all(arr).then(function (values) {
      var res = {};
      values.forEach(function (value) {
        var temp = merge(res, value.result);
        res = temp;
      });
      var builder = new xml2js.Builder();
      var buildjs = utils.cleanup(res);
      var xml = builder.buildObject(buildjs);
      return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(xml));
    });
  }
}

export function activate (context: vscode.ExtensionContext) {
  const mergePackage = vscode.commands.registerCommand('swa.package.merge', (...commandArgs) => {
    const wspaces = utils.getRootPath();
    const wspath = wspaces.fsPath;
    packageMerge(commandArgs[1], wspath + '/manifest/deploymanifest.xml');
  });
  const retrievePackage = vscode.commands.registerCommand('swa.package.retrieve', (...commandArgs) => {
    packageRetrieve(commandArgs[1]);
  });
  const deployPackage = vscode.commands.registerCommand('swa.package.deploy', (...commandArgs) => {
    packageDeploy(commandArgs[1], false);
  });
  const validatePackage = vscode.commands.registerCommand('swa.package.validate', (...commandArgs) => {
    packageDeploy(commandArgs[1], true);
  });
  const syncPackage = vscode.commands.registerCommand('swa.package.sync', (...commandArgs) => {
    convertSource(commandArgs[1]);
  });
  vscode.commands.executeCommand('setContext', 'swa.supportedFolders', [
    'manifest'
  ]);
  context.subscriptions.push(retrievePackage, mergePackage, validatePackage, deployPackage, syncPackage);
}

// this method is called when your extension is deactivated
export function deactivate () {}
