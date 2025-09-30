(() => {
    const params = scriptQuery();
    const sTopPageYn = params?.isTopPage ?? 'N';

    if ($wai.default?.waiDataIoUse === true || $wai.default?.waiDataIoUse === 'Y') {
        document.write("<!--wai.dataio.load.start-->");

        let filePath = `${$wai.info.path}/lib/waiDataIO.js`;
        if (document.querySelector(`script[src='${filePath}']`) == null) {
            const scriptElem = document.createElement('script');
            document.head.appendChild(scriptElem);
            scriptElem.setAttribute('type', 'text/javascript');
            scriptElem.setAttribute('src', filePath);
        }

        if (sTopPageYn == 'Y') {
            filePath = `${$wai.info.path}/lib/waiDataIOInterface.js`;
            if (document.querySelector(`script[src='${filePath}']`) == null) {
                const scriptElem = document.createElement('script');
                document.head.appendChild(scriptElem);
                scriptElem.setAttribute('type', 'text/javascript');
                scriptElem.setAttribute('src', filePath);
            }
        }

        document.write("<!--wai.dataio.load.end-->");
    }

    function scriptQuery() {
        var script = document.getElementsByTagName('script');
        script = script[script.length-1].src
            .replace(/^[^\?]+\?/, '')
            .replace(/#.+$/, '')
            .split('&');
        var queries = {}
            , query;
        while(script.length){
            query = script.shift().split('=');
            queries[query[0]] = query[1];
        }
        return queries;
    }
})();