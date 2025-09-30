(function(){/**/
    var _repDefaults = function() {

        this.dataServiceDefault = {
            //--------------------------------------------
            // properties - default value setting
            mapUrl      : '',     
            serviceUrl  : 'http://223.223.11.58:8188/svct/CDService',
            serviceName : '',     
            methodName  : '',     
            dsoNames    : '',     
            timeOut     : 5000,   
            async       : false,
            mapType     : 'xml',  
            dataType    : 'xml',  
            dsoPublic   : true,   

            onErrorThrow : false,
            //--------------------------------------------
            // event callback(s) // do not change value(s)
            onBeforeCall       : null,
            onBeforeCallAttach : null,
            onAfterCallDetach  : null,
            onAfterCall        : null,
            onResultError      : null,
            //--------------------------------------------
            // Etc Options
            fieldNameCaseSen   : 'upper'   // upper = upperCase convert // lower = lowerCase convert // none
        };
        this.downInfo = {
            serviceDomain   : 'ws://127.0.0.1:9892',
            webRoots        : '/',
            websocket       : false,
            dataService     : 'http://223.223.11.58:8090/JSONDataService',
            async           : true,
            timeOut         : 10000,
            serviceLog      : false
        };
        this.clientServiceDefault = {
            port        : 9515
        };
        this.waiRepPath = '';
        this.dateFormat    = 'yyyymmdd';
        this.dateSeparator = '/';

        this.nodeServiceDefault = {
            serviceDomain  : 'http://127.0.0.1:3000',
            timeout        : 10000
        }
        this.waiRepIDEDefault = {
            prevServer   : true,   // (true: server generate , false: client generate )
            prevQuality  : 0.5,
            dataCompress : true
        }

    };

    $waiReport.default = new _repDefaults();
})();
// END of file