# Southwest Salesforce Extension

Southwest SWA Salesforce (swa) extension aims to provide Southwest Salesforce developers and DevOps engineers tools for common Salesforce development tasks.

## Requirements
To use this extension, the following plugins are required/sugested:
1. Salesforce Extension Pack
2. SFDX CLI

## Fetures
1. SWA: Merge Package XML
Merge multiple package XML files together

2. SWA: Retrieve Package
Custom Retrieve using a custom package xml file. Merges supported metadata into existing files.

3. SWA: Validate Package
Custom Validate using a custom package xml file. Generates and validates a delta file for supported metadata, but leaves existing metadata files as is. 

4. SWA: Deploy Package
Custom Deploy using a custom package xml file. Generates and deploys a delta file for supported metadata, but leaves existing metadata files as is. 

5. SWA: Convert to MDAPI
Convert components from package xml from source format to MDAPI format.

## Custom Package XML
1. Profile
    * userPermissions
    * fieldPermissions
    * layoutAssignments
    * objectPermissions
    * tabVisibilities
    * recordTypeVisibilities
    * applicationVisibilities
    * categoryGroupVisibilities
    * classAccesses
    * customMetadataTypeAccesses
    * customPermissions
    * pageAccesses

2. Permission Set
    * same as Profile

3. Custom Object
    * actionOverrides
    * searchLayouts

## Additional Mergable Metadata Types
1. Custom Labels

* Other Metadata types behave same as SFDX




