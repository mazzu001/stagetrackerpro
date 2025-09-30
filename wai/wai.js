(function(){
    const params = scriptQuery();
    const sIdeYn = params.isWaiIDE ?? 'N';
    const sTopPageYn = params.isTopPage;
    const sAutoCallJsYn = params.autoCallJS;
    let sep = '?';

    let arrLib = [];
    try{
        arrLib = JSON.parse(document.querySelector('script[src="/wai/wai.js"]')?.innerText ?? '[]');
    }catch(e){}

    let waiScript = '/wai/waiRuntime.js';
    if(arrLib.length > 0){
        waiScript += `${sep}loadLib=${arrLib.filter(elem => elem.type == 'library').map(elem => elem.id).join(',')}`;
        sep = '&';
    }
    let topPage   = (window.parent.location.pathname+'').split("/").pop();
    try{
        topPage   = (window.top.location.pathname+'').split("/").pop();
    }catch(e){};

    let isTopPage = sTopPageYn ? (sTopPageYn == 'Y') : (topPage == 'waiHtmlEditor.html') || (topPage == 'waiHtmlEditorMain.html');
    if(sIdeYn == 'Y' || isTopPage){
        waiScript += `${sep}isWaiIDE=Y`;
        sep = '&';
        if (isTopPage) {
            waiScript += `${sep}isTopPage=Y`;
        }
    }

    if (sAutoCallJsYn) {
        waiScript += `${sep}autoCallJS=${sAutoCallJsYn}`;
        sep = '&';
    }

    //document.write('<!--wai.load.start--><script type="text/javascript" src="'+waiScript+'">'+"</script>\n");
    document.write('<!--waipage.load.start--><script type="text/javascript" src="'+waiScript+'">'+"</script><!--waipage.load.end-->\n");

    function scriptQuery() {
        let script = document.getElementsByTagName('script');
        script = script[script.length-1].src
            .replace(/^[^\?]+\?/, '')
            .replace(/#.+$/, '')
            .split('&');
        let queries = {}
            , query;
        while(script.length){
            query = script.shift().split('=');
            queries[query[0]] = query[1];
        }
        return queries;
    }
})();