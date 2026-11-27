// Upload status of a cloud backup file in the app's iCloud container (cloud backup, plan B2).
// A write to the container is local first; iOS uploads it later. The backup is "done" only when
// iCloud reports this file as uploaded. The file is the one react-native-cloud-storage writes in
// its app-data scope: the root of the default ubiquity container. Reads metadata only, never the
// file content.
#import <React/RCTBridgeModule.h>
#import <Foundation/Foundation.h>

@interface ValuICloudStatus : NSObject <RCTBridgeModule>
@end

@implementation ValuICloudStatus

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// Resolves {uploaded, uploading, failed}. Rejects "no_container" without iCloud, "bad_name" for a
// name that is not a plain file name.
RCT_EXPORT_METHOD(uploadState:(NSString *)name
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    if (name.length == 0 || [name containsString:@"/"] || [name hasPrefix:@"."]) {
      reject(@"bad_name", @"Invalid file name", nil);
      return;
    }
    NSURL *root = [[NSFileManager defaultManager] URLForUbiquityContainerIdentifier:nil];
    if (root == nil) {
      reject(@"no_container", @"No iCloud container", nil);
      return;
    }
    NSURL *url = [root URLByAppendingPathComponent:name isDirectory:NO];
    // Cached values can be old: read the current state.
    [url removeAllCachedResourceValues];
    NSError *error = nil;
    NSDictionary *values = [url resourceValuesForKeys:@[
      NSURLUbiquitousItemIsUploadedKey,
      NSURLUbiquitousItemIsUploadingKey,
      NSURLUbiquitousItemUploadingErrorKey,
    ] error:&error];
    if (values == nil) {
      reject(@"no_file", @"No upload state", nil);
      return;
    }
    resolve(@{
      @"uploaded" : @([values[NSURLUbiquitousItemIsUploadedKey] boolValue]),
      @"uploading" : @([values[NSURLUbiquitousItemIsUploadingKey] boolValue]),
      @"failed" : @(values[NSURLUbiquitousItemUploadingErrorKey] != nil),
    });
  });
}

@end
