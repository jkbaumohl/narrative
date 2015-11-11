/**
 * Loads the required narrative configuration files.
 * This should mainly be invoked by the starting app, then
 * that result should be injected where necessary.
 *
 * @author Bill Riehl <wjriehl@lbl.gov>
 * @class narrativeConfig
 * @module Narrative
 * @static
 */
define(['jquery', 
        'json!kbase/config.json',
        'json!kbase/icons.json'
], function($,
            configSet,
            iconsSet) {
    "use strict";

    // Get the workspace id from the URL
    var workspaceId = null;
    var m = window.location.href.match(/ws\.(\d+)\.obj\.(\d+)/);
    if (m && m.length > 1)
        workspaceId = parseInt(m[1]);

    // Build the config up from the configSet (from config.json)
    var config = {
        urls:            configSet[configSet['config']],
        version:         configSet['version'],
        name:            configSet['name'],
        git_commit_hash: configSet['git_commit_hash'],
        git_commit_time: configSet['git_commit_time'],
        release_notes:   configSet['release_notes'],
        mode:            configSet['mode'],
        icons:           iconsSet,
        workspaceId:     workspaceId,
        loading_gif:     configSet['loading_gif'],
        use_local_widgets: configSet['use_local_widgets']
    };
    // Add a remote UI-common to the Require.js config
    require.config({
        paths: {
            'uiCommonPaths': config.urls.ui_common_root + "widget-paths"
        }
    });

    /**
     * Updates the RequireJS config with additional locations from 
     * a config given by the ui-common repo. This file is expected to be 
     * called "widget-paths.js" and should be deployed in the configured
     * ui-common location.
     *
     * Note that this is optional. If we're expected to use local widgets,
     * as configured with the use_local_widgets flag, then skip this step
     * and just run the callback.
     */
    var updateConfig = function(callback) {
        if (config.use_local_widgets != true) {
            require(['uiCommonPaths'], function(pathConfig) {
                for (var name in pathConfig.paths) {
                    pathConfig.paths[name] = config.urls.ui_common_root + pathConfig.paths[name];
                }
                require.config(pathConfig);
                config.new_paths = pathConfig;
                if (callback)
                    callback(config);
            }, function(error) { 
                console.log("Unable to get updated widget paths. Sticking with what we've got.");
                if (callback)
                    callback(config);
            });
        }
        else {
            if (callback)
                callback(config);
        }
    };

    return {
        updateConfig: updateConfig,
        config: config
    };
});