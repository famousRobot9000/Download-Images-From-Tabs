
debug = false;

function isVisible(e) {
    return !!( e.offsetWidth || e.offsetHeight || e.getClientRects().length );
}

function isImageLoaded(img) {
	
    if (!img.complete) {
        return false;
    }

    if (img.naturalWidth === 0) {
        return 'error';
    }

    return true;
}


var App = {
	settings:{},
	
	sendMessage : function(action,data){
		return new Promise(function(resolve, reject){
			if (typeof data=='undefined'){
				data={};
			}
			browser.runtime.sendMessage({
				'action':action,
				'data':data
			}).then(resolve);
			
		});
	},
	
	init : function(){
		if (debug){
			console.log("Content script attached");
		}
		browser.runtime.onMessage.removeListener(App.executeAction);
		browser.runtime.onMessage.addListener(App.executeAction);
		App.loadSettings()
		.then(App.attachedMessage)
		.then(function(){
			App.addImages();
		});

	},
	
	attachedMessage : function(){
		return new Promise(function(resolve, reject){	
			var data={status:'attached'}
			App.sendMessage('updateTabsDownloadQueue',data).then(resolve);
		});
	},
	
	addImages : function(){
		
		var arr = document.getElementsByTagName('img');

		if (!arr.length){
			App.sendMessage('updateTabsDownloadQueue',{status:'parsed'});
			return;
		}
		
		//App.imgsDom = arr.slice(0,arr.length-1);
		for (let i = 0; i < arr.length; i++){
			App.imgsDom.push(arr[i]);
		};
		
		for (let i = 0; i < App.imgsDom.length-1; i++){
			if ( App.imgsDom[i].src==undefined 
			|| App.imgsDom[i].src=='' || App.imgsDom[i].src.toLowerCase().startsWith("data:") ){
				App.imgsDom.splice(i,1);
				i--;
				continue;
			}
			for (let j = i+1; j < App.imgsDom.length; j++){
				if (App.imgsDom[i].src==App.imgsDom[j].src){
					App.imgsDom.splice(j,1);
					j--;
					continue;
				}
			}

		}
		
		//console.log(App.imgsDom)
		
		for (var i = 0; i < App.imgsDom.length; i++){
			if ( isVisible(App.imgsDom[i]) ){
				App.imgs.push({'imgId': i, 'loaded':false })
			}
		}
	
		setTimeout(App.waitForImages, 0);
	},
	
	imgsDom : [],
	imgs : [],
	maxTimeout : 50000,
	currentTimout : 0,
	
    waitForImages : function(){
		if (App.canceled){
			return;
		}
		
		var timeoutMs = 600;
		var im;
		var allLoaded = true;
		for (var i = 0; i < App.imgs.length; i++){
			im = App.imgs[i];
			if (im.loaded) continue;
			var isLoaded = isImageLoaded(App.imgsDom[im.imgId]);
			
			if ( isLoaded=='error' ){
				im.loaded='error';
				continue;
			}	
			
			if ( isLoaded ){
				im.loaded = true;
			}else{
				allLoaded = false;
			}
		}
	
		App.currentTimout+=timeoutMs;
	
		if ( App.currentTimout>App.maxTimeout || allLoaded ){
			App.sendImages();
		}else{
			setTimeout(App.waitForImages, timeoutMs);
		}
	},
	
	sendImages : function(images){
		var data={
			'status' : 'parsed',
			'images' : images
		};
		var maxSize = 0;
		var maxId = -1;
		
		var goodImgs = [];
		
		function addImageToGood(src){
			/*for ( let i=0; i<goodImgs.length; i++ ){
				if (goodImgs[i].url==src){
					return;
				}
			}*/
			goodImgs.push({
				'url': src,
				'status':'ready'
			});
		}
		
		function isPassingMinSize(w,h){
			if (w<=h){
				if ( w>App.settings.minSizePortrait.width && h>App.settings.minSizePortrait.height){
					return true;
				}
			}else if (w>h){
				if ( w>App.settings.minSizeLandscape.width && h>App.settings.minSizeLandscape.height){
					return true;
				}
				
			}
			
			return false;
			
		}
		
		for (var i = 0; i < App.imgs.length; i++){
			var im = App.imgs[i];
			imObj = App.imgsDom[im.imgId]
		
			if ( !im.loaded || im.loaded=='error') continue;
			
			var w = imObj.naturalWidth;
			var h = imObj.naturalHeight;
			var src = App.imgsDom[im.imgId].src;
			if ( !App.settings.onlyLargestImage ){
				if ( isPassingMinSize(w,h) ){
					addImageToGood(src);
				}
			}
			
			if ( w*h>maxSize ){
				maxSize = w*h;
				maxId = i;
			}
		}
	
		
		if ( App.settings.onlyLargestImage && maxId!=-1 ){
			var imObj = App.imgsDom[App.imgs[maxId].imgId]
			var src = imObj.src;		
			if ( isPassingMinSize(imObj.naturalWidth,imObj.naturalHeight) ){
				addImageToGood(src);
			}
		}
		
		if (App.canceled) return;
		
		var data={
			'status':'parsed',
			'images':goodImgs
		}
		
		App.sendMessage('updateTabsDownloadQueue',data);
	},
	
	loadSettings : function(){
		return new Promise(function(resolve, reject){
			App.sendMessage('getSettings').then(
			function(data){
				App.settings = data.settings;
				resolve();
				if (debug){
					console.log("Content set settings");
					console.log(App.settings);
				}
			});
		});
	},
	
	canceled:0,
	
	executeAction : function (message, sender, sendResponse){
		var action = message.action;
		var data = message.data;
		if (debug){
			console.log("Recived message popup");
			console.log(message);
		}
		switch (action){
			case 'cancel': 
				App.canceled = 1;
				break;
				
		}
	}	
}

App.init();
