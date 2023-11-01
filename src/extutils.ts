import * as vscode from 'vscode'
import { TextEncoder } from 'util';
const path = require('path');
const merge = require('deepmerge');
const xml2js = require('xml2js');
const homedir = require('os').homedir();
const _home = path.resolve(`${homedir}/.swa/source`);
const wspaces = getRootPath();
const _ws = wspaces.fsPath;

export function getUri (uri: string) {
  return vscode.Uri.file(path.normalize(uri));
}

export function getRootPath ():vscode.Uri {
  const rPath = vscode.workspace.workspaceFolders;
  if (rPath) {
    return rPath[0].uri;
  } else {
    return vscode.Uri.parse(path.normalize(`${__dirname}/../`));
  }
}

export function removeDuplicates (arr:any[]) {
  const unique: any[] = [];
  arr.forEach(element => {
    if (!unique.includes(element)) {
      unique.push(element);
    }
  });
  return unique;
}

export function getTypeMap (input:any) {
  var typemap = new Map<string, any>();
  for (var i = 0; i < input.Package.types.length; i++) {
    var type = input.Package.types[i];
    var name: string = type.name[0];
    if (isEqual(name, 'CustomLabel')) { name += 's'; }
    if (!typemap.has(name)) { typemap.set(name, {}); }
    var n = merge(typemap.get(name), type);
    typemap.set(name, n);
  }
  return typemap;
}

export function getMetadataMap (typemap: Map<string, any>, wspath: string, isRetrieve: boolean) {
  var m : Map<string, any> = new Map();
  var baseUrl : string = _home + '/force-app/main/default';
  var wsbaseUrl :string = wspath + '/force-app/main/default';
  var input : string[] = [...typemap.keys()];
  var hasLabels = false;
  for (var i = 0; i < input.length; i++) {
    var promises : any[] = [];
    for (var j = 0; j < typemap.get(input[i]).members.length; j++) {
      var files : vscode.Uri[] = [];
      var member = typemap.get(input[i]).members[j];
      if (isEqual(input[i], 'Profile')) {
        if (isRetrieve) { files.push(getUri(baseUrl + '/profiles/' + member + '.profile-meta.xml')); }
        files.push(getUri(wsbaseUrl + '/profiles/' + member + '.profile-meta.xml')); 
      }
      if (isEqual(input[i], 'PermissionSet')) {
        if (isRetrieve) { files.push(getUri(baseUrl + '/permissionsets/' + member + '.profile-meta.xml')); }
        files.push(getUri(wsbaseUrl + '/permissionsets/' + member + '.profile-meta.xml'));
      }
      if (isEqual(input[i], 'CustomObject')) {
        if (isRetrieve) { files.push(getUri(baseUrl + '/objects/' + member + '/' + member + '.object-meta.xml')); }
        files.push(getUri(wsbaseUrl + '/objects/' + member + '/' + member + '.object-meta.xml'));
      }
      if (isRetrieve && !hasLabels) {
        if (isEqual(input[i], 'CustomLabel') || isEqual(input[i], 'CustomLabels')) {
          files.push(getUri(baseUrl + '/labels/CustomLabels.labels-meta.xml'));
          files.push(getUri(wsbaseUrl + '/labels/CustomLabels.labels-meta.xml'));
          hasLabels = true;
        }
      }
      if (files.length > 0) {
        promises.push(new Promise(function (resolve, reject) {
          Promise.all(convertToJSON(files)).then(function (result) { 
            resolve(result);
          });
        }));
      }
    }
    if (promises.length > 0) {
      m.set(input[i], promises);
    }
  }
  return m;
}

export function cleanup (input:any) {
  var typemap = getTypeMap(input);
  input.Package.types.length = 0;
  typemap.forEach(function (type, name) {
    for (const key of Object.keys(type)) {
      var t = removeDuplicates(type[key]);
      type[key].length = 0;
      type[key].push(...t);
    }
    input.Package.types.push(type);
  });
  var ver = 0;
  var txt = '';
  input.Package.version.forEach(function (value: string) {
    var temp = Number(value);
    if (temp > ver) { txt = value; ver = temp; }
  });
  input.Package.version = [txt];
  return input;
}

export function convertToJSON (uris : Array<vscode.Uri>) {
  var arr: any[] = [];
  uris.forEach(async function (file) {
    const myPromise = new Promise(function (resolve, reject) {
      vscode.workspace.openTextDocument(file).then(async (document) => {
        var xmltext = document.getText();
        xml2js.parseString(xmltext, function (err: any, result: string) {
          if (!err) {
            resolve({ fileName: document.fileName, result: result });
          } else {
            reject(err);
          }
        });
      });
    });
    arr.push(myPromise);
  });
  return arr;
}

export function getNameFromPermission (permission: string):string {
  var name = '';
  if (isEqual(permission, 'applicationVisibilities')) { name = 'CustomApplication'; }
  if (isEqual(permission, 'classAccesses')) { name = 'ApexClass'; }
  if (isEqual(permission, 'fieldPermissions')) { name = 'CustomField'; }
  if (isEqual(permission, 'layoutAssignments')) { name = 'Layout'; }
  if (isEqual(permission, 'objectPermissions')) { name = 'CustomObject'; }
  if (isEqual(permission, 'pageAccesses')) { name = 'ApexPage'; }
  if (isEqual(permission, 'recordTypeVisibilities')) { name = 'RecordType'; }
  if (isEqual(permission, 'tabVisibilities')) { name = 'CustomTab'; }
  return name;
}

export function getNameFieldFromPermission (permission: string):string {
  var fieldname = '';
  if (isEqual(permission, 'applicationVisibilities')) { fieldname = 'application'; }
  if (isEqual(permission, 'classAccesses')) { fieldname = 'apexClass'; }
  if (isEqual(permission, 'fieldPermissions')) { fieldname = 'field'; }
  if (isEqual(permission, 'layoutAssignments')) { fieldname = 'layout'; }
  if (isEqual(permission, 'objectPermissions')) { fieldname = 'object'; }
  if (isEqual(permission, 'pageAccesses')) { fieldname = 'apexPage'; }
  if (isEqual(permission, 'recordTypeVisibilities')) { fieldname = 'recordType'; }
  if (isEqual(permission, 'tabVisibilities')) { fieldname = 'tab'; }
  return fieldname;
}

export function buildManifest (manifests: any[], fileUri: vscode.Uri, wsUri: vscode.Uri) {
  var manifeststring = JSON.stringify(manifests[0]);
  var manifest = JSON.parse(manifeststring);
  var ogmanifest = JSON.parse(manifeststring);
  var newtypes : any[] = [];
  var ogtypes : any[] = [];
  var typenames : any[] = [];
  for (var i = 0; i < manifest.result.Package.types.length; i++) {
    const name = manifest.result.Package.types[i].name[0];
    typenames.push(name);
    if (isPartial(name)) {
      for (const key of Object.keys(manifest.result.Package.types[i])) {
        if (!isEqual('name', key) && !isEqual('members', key) && !isEqual('userPermissions', key)) {
          var newtype = buildType(key, manifest.result.Package.types[i][key]);
          newtypes.push(newtype);
          delete manifest.result.Package.types[i][key];
          if (isEqual(key, 'userPermissions')) {
            delete manifest.result.Package.types[i].userPermissions;
          }
        }
      }
    } else {
      ogtypes.push(manifest.result.Package.types[i]);
    }
  }
  ogmanifest.result.Package.types.length = 0;
  ogmanifest.result.Package.types = ogtypes;
  newtypes.forEach(function (type) { manifest.result.Package.types.push(type); });
  var builder = new xml2js.Builder();
  var xml1 = builder.buildObject(cleanup(manifest.result));
  var xml2 = builder.buildObject(cleanup(ogmanifest.result));
  var returnval: any[] = [];
  returnval.push(manifest);
  returnval.push(ogmanifest);
  returnval.push(manifests[0]);
  return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(xml1))
    .then(function () {
      return vscode.workspace.fs.writeFile(wsUri, new TextEncoder().encode(xml2)).then(function () { return returnval; });
    });
}

function buildType (permission: string, members: any[]) {
  var name = getNameFromPermission(permission);
  return { name: [name], members: members };
}

export function isEqual (string1: string, string2: string) {
  return (string1.toLowerCase() === string2.toLowerCase());
}

export function isPartial (type: string) : boolean {
  const partials: any[] = ['profile', 'permissionset', 'customlabel', 'customobject'];
  return partials.includes(type.toLowerCase());
}

export function getKeysByRoot (root:string) :string[] {
  var keys : string[] = [];
  if (isEqual(root, 'Profile')) {
    keys = [];
  }
  return keys;
}
export function convertType (type: any) {
  const _homedir = _home + '\\force-app\\main\\default\\';
  const _wsdir = _ws + '\\force-app\\main\\default\\';
  var values :any[] = [];
  var name:string = type.name[0];
  var source = _homedir;
  var dest = _wsdir;
  var root: string = '';
  for (var i = 0; i < type.members.length; i++) {
    if (isEqual(name, 'Profile')) {
      source += '\\profile\\' + type.members[i] + '.profile-meta.xml';
      dest += '\\profile\\' + type.members[i] + '.profile-meta.xml';
      values.push(convertMember(source, dest));
      root = 'Profile';
    } else if (isEqual(name, 'PermissionSet')) {
      source += '\\permissionsets\\' + type.members[i] + '.permissionset-meta.xml';
      dest += '\\permissionsets\\' + type.members[i] + '.permissionset-meta.xml';
      values.push(convertMember(source, dest));
      root = 'PermissionSet';
    } else if (isEqual(name, 'CustomLabel') || isEqual(name, 'CustomLabels')) {
      source += '\\labels\\CustomLabels-meta.xml';
      dest += '\\labels\\CustomLabels-meta.xml';
      values.push(convertMember(source, dest));
      name = 'CustomLabels';
    } else if (isEqual(name, 'CustomObject')) {
      source += '\\objects\\' + type.members[i] + '\\' + type.members[i] + '.object-meta.xml';
      dest += '\\objects\\' + type.members[i] + '\\' + type.members[i] + '.object-meta.xml';
      values.push(convertMember(source, dest));
      root = 'Object';
    }
  }
  Promise.all(values).then(function (jsons) {
    for (const key of getKeysByRoot(root)) {
      for (var i = 0; i < type[key].length; i++) {
      }
    }
  });
}

export function convertMember (dir1: string, dir2: string) {
  var values :any[] = []
  values.push(getUri(dir1));
  values.push(getUri(dir2));
  return new Promise(function (resolve, reject) {
    resolve(Promise.all(convertToJSON(values)));
  });
}
