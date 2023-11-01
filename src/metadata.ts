import * as utils from './extutils';

export class Metadata {
  public m:any;
  public mmap: Map<string, any>;
  public name: string;
  public typemap: Map<any, any>;

  public constructor (m: any, typemap: Map<any, any>) {
    this.typemap = typemap;
    this.mmap = new Map();
    this.name = '';
    // Loop through object properties and set to map
    for (const [key, value] of Object.entries(m)) {
      this.m = value;
      this.name = key;
    }
    for (const [key, value] of Object.entries(this.m)) {
      this.mmap.set(key, value);
    }
  }

  public merge (input: any) {
    var inmap = new Map();
    var inputobj:any;
    for (const value of Object.values(input)) {
      inputobj = value;
    }
    for (const [key, value] of Object.entries(inputobj)) {
      inmap.set(key, value);
    }
    for (const [key, value] of Object.entries(this.m)) {
      console.log(this.name + ':' + key);
      var values = value as any[];
      for (var a = 0; a < values.length; a++) {
        var ispresent: boolean = false;
        var v = (typeof values[a] === 'object') ? values[a][this.getKeyField(key)][0] : values[a];
        console.log(this.name + ':' + key + ':' + v);
        if (this.inManifest(this.name, key, v)) {
          if (inmap.has(key)) {
            for (var i = 0; i < inmap.get(key).length; i++) {
              console.log('inmap:' + key + ':' + JSON.stringify(inmap.get(key)[i]));
              if (typeof inmap.get(key)[i] === 'object') {
                if (utils.isEqual(inmap.get(key)[i][this.getKeyField(key)][0], v)) {
                  ispresent = true;
                  inmap.get(key)[i] = values[a];
                  break;
                }
              } else if (typeof inmap.get(key)[i] === 'string') {
                if (utils.isEqual(inmap.get(key)[i], v)) {
                  ispresent = true;
                  inmap.get(key)[i] = v;
                  break;
                }
              }
            }
          } else {
            inmap.set(key, []);
          }
          if (!ispresent) {
            inmap.get(key).push(values[a]);
          }
        }
      }
    }
    var toreturn:any = {};
    toreturn[this.name] = {};
    for (const key of inmap.keys()) {
      var val : any[] = inmap.get(key);
      if (utils.isEqual(key, 'labels') && utils.isEqual(this.name, 'CustomLabels')) {
        console.log('merging custom labels....');
        console.log(typeof val);
        console.log(val);
        val.sort(function (a:any, b:any) {
          var nameA = a.fullName[0].toLowerCase();
          var nameB = b.fullName[0].toLowerCase();
          if (nameA < nameB) {
            return -1;
          }
          if (nameA > nameB) {
            return 1;
          }
          return 0;
        });
      }

      toreturn[this.name][key] = val;
    }
    console.log('to return: ');
    console.log(toreturn);
    return toreturn;
  }

  public inManifest (typename: string, key: string, value: string) {
    var keys: string[] = [...Object.keys(this.typemap.get(typename))];
    var retval = false;
    if (utils.isEqual(typename, 'CustomLabels')) { key = 'members'; }
    if (this.typemap.has(typename)) {
      if (keys.length <= 2 && !utils.isEqual(typename, 'CustomLabels')) {
        retval = true;
      } else {
        if (keys.includes(key)) {
          for (var j = 0; j < this.typemap.get(typename)[key].length; j++) {
            console.log(key + ':' + j + ': ' + this.typemap.get(typename)[key][j]);
            if (utils.isEqual(this.typemap.get(typename)[key][j], value)) {
              retval = true;
              break;
            }
          }
        }
      }
    }
    console.log('Is ' + typename + ':' + key + ':' + value + ' In Manifest: ' + retval)
    return retval;
  }

  public getValue (key:string, value: any) {
    var toreturn = null;
    var arr: any[] = this.mmap.get(key);
    for (var i = 0; i < arr.length; i++) {
      if (utils.isEqual(typeof arr[i], 'string')) {
        if (utils.isEqual(arr[i], value)) {
          toreturn = arr[i];
        }
      } else if (utils.isEqual(typeof arr[i], 'object')) {
        var keyfield = this.getKeyField(key);
        if (utils.isEqual(arr[i][keyfield][0], value)) {
          toreturn = arr[i];
        }
      }
    }
    return toreturn;
  }

  public filter () {
    var returnval:any = {}
    returnval[this.name] = {};
    var doFilter = false;
    console.log('keys: ' + JSON.stringify([...this.typemap.keys()]));
    console.log('this.name --> ' + this.name);
    for (const key of Object.keys(this.typemap.get(this.name))) {
      console.log('filter key: ' + key);
      if (!utils.isEqual(key, 'Name') && !utils.isEqual(key, 'Members')) {
        doFilter = true;
        var holder: any[] = [];
        var arr: any[] = this.typemap.get(this.name)[key];
        for (var i = 0; i < arr.length; i++) {
          holder.push(this.getValue(key, arr[i]));
        }
        if (holder.length > 0) {
          returnval[this.name][key] = holder;
        }
      }
    }
    console.log('do filter: ' + doFilter);
    if (!doFilter) { returnval = this.m; }
    return returnval;
  }

  public setName (name:string) {
    this.name = name;
  }

  public getKeyField (key:string):string {
    var toreturn = '';
    if (utils.isEqual(this.name, 'Profile') || utils.isEqual(this.name, 'PermissionSet')) {
      switch (key) {
        case 'userPermissions':
          toreturn = 'name';
          break;
        case 'fieldPermissions':
          toreturn = 'field';
          break;
        case 'layoutAssignments':
          toreturn = 'layout';
          break;
        case 'objectPermissions':
          toreturn = 'object';
          break;
        case 'tabVisibilities':
          toreturn = 'tab';
          break;
        case 'recordTypeVisibilities':
          toreturn = 'recordType';
          break;
        case 'applicationVisibilities':
          toreturn = 'application';
          break;
        case 'categoryGroupVisibilities':
          toreturn = 'dataCategoryGroup';
          break;
        case 'classAccesses':
          toreturn = 'apexClass';
          break;
        case 'customMetadataTypeAccesses':
          toreturn = 'name';
          break;
        case 'customPermissions':
          toreturn = 'name';
          break;
        case 'pageAccesses':
          toreturn = 'apexPage';
          break;
      };
    }
    if (utils.isEqual(this.name, 'CustomLabel') || utils.isEqual(this.name, 'CustomLabels')) {
      toreturn = 'fullName';
    }
    if (utils.isEqual(this.name, 'CustomObject')) {
      switch (key) {
        case 'actionOverrides':
          toreturn = 'actionName';
          break;
        case 'searchLayouts':
          toreturn = 'searchResultsAdditionalFields';
          break;
      };
    }
    return toreturn;
  }
}
