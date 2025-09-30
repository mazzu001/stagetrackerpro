(function(){
    if ($waiReport === undefined) return;

    var imgDatas = {
        'bandCtrl':{
             'show':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAfklEQVRYR+2WUQoAIQgF61ye33NtEPRRu1uGiUWv7+gNk4oxOJ/onB8A8DJARI/ltzBzlbkvQEuqtVLMig2cAlDqZdhNVgYAAAN3GNCO5tyimjZ0B+hN4TtqAAZgYGsD4kVJM4jEIb2L0wBLUj8eEe+EbgBWwX/vDpdJayAAJHflwCGrUeAgAAAAAElFTkSuQmCC'
            ,'hide':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAbUlEQVRYR+2X0QqAIBAE9bvu+++7DISgrEDYZIPGd2/HERatxbyqOb8AcDEQEW3ltWTmKfO7ACOpamU3O20AAAxgAAMHA2o197ZVisgOoLZw368YAAADGPipgVeOfTNk+k1oA1gV/DSXr5ndwAaKtrIhkgQ4zwAAAABJRU5ErkJggg=='
            ,'showOn':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAeUlEQVRYR+2XSxLAIAhDzf0PTVcu/LWKMtAxHoCEJ2YQyfnAWT/RQENARMTyWgAUmnEN1E53qWSy0wR+YWDUVY+WCQEaIIE7COxGc84T9TN0N/AWwXfMAAmQQGgCK1uSOohWRDS04i6lpzqv63wupVbCo7r8mrkTeAD9K/AhEknWnAAAAABJRU5ErkJggg=='
            ,'hideOn':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAaElEQVRYR+3XQQoAIQxDUXP/Q3dWXdhhQKmSWXz3tuEJATXMR+b9gwAvgYiIm88iadr53wA1aVclZZcFCIAAAgikQLea65ztIrIH6FZw3qeKEUAAgW2BUwVU5yxXsS3ArcVfc/ma2QUe9G+4IajovS8AAAAASUVORK5CYII='

        }
    };

    var imgLoader = function(data){
        //var imgs = [];
        function load(p,d){
            for (var x in d){
                if (typeof(d[x])==typeof('')){
                    var i = document.createElement('img');
                    i.src = d[x];
                    //imgs.push(i);
                    p[x] = i;
                } else if (typeof(d[x])==typeof({})){
                    p[x] = {};
                    load(p[x],d[x]);
                }
            }
        }
        load(this,data);
    };

    $waiReport['images'] = new imgLoader(imgDatas);
})();