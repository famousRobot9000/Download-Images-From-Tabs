
debug = false;

browser.contextMenus.create({
    id: "left",
    title: "Download images from left tabs",
	"icons": {
      "48": "icons/ic_arrow_back_black_24dp_2x.png"
    },
    contexts: ["browser_action","page","tab"]
});

browser.contextMenus.create({
    id: "active",
    title: "Download images from current tab",
	"icons": {
      "48": "icons/ic_arrow_downward_black_24dp_2x.png"
    },
    contexts: ["browser_action","page","tab"]
});

browser.contextMenus.create({
    id: "right",
    title: "Download images from right tabs",
	"icons": {
      "48": "icons/ic_arrow_forward_black_24dp_2x.png"
    },
   contexts: ["browser_action","page","tab"]
});



browser.contextMenus.create({
    id: "download-tabs",
    title: "Open selected links in tabs and download",
	"icons": {
      "48": "icons/ic_file_download_black_24dp_2x.png"
    },
    contexts: ["selection"]
});

browser.contextMenus.create({
    id: "open-tabs",
    title: "Open selected links in tabs",
	"icons": {
      "48": "icons/ic_open_in_new_black_24dp_2x.png"
    },
    contexts: ["selection"]
});


browser.contextMenus.create({
    id: "download-linked-images",
    title: "Open selected linked images in tabs and download",
	"icons": {
      "48": "icons/ic_file_download_black_24dp_2x.png"
    },
    contexts: ["selection"]
});

browser.contextMenus.create({
    id: "open-linked-images",
    title: "Open selected linked images in tabs",
	"icons": {
      "48": "icons/ic_open_in_new_black_24dp_2x.png"
    },
    contexts: ["selection"]
});

browser.contextMenus.create({
    id: "one-link",
    title: "Open link in tab and download",
	"icons": {
      "48": "icons/ic_file_download_black_24dp_2x.png"
    },
    contexts: ["link"]
});



browser.contextMenus.create({
    id: "one-click-mode",
    title: "Enable one click mode",
	type:"checkbox",
    contexts: ["browser_action"]
});



browser.contextMenus.onClicked.addListener(function(info, tab){
	if (App.downloadStarted && info.menuItemId!='one-click-mode'){
		return;
	}

	var needDownload=(info.menuItemId=='download-tabs' || info.menuItemId=='download-linked-images'?true:false);
	var linkedImages=(info.menuItemId=='download-linked-images' || info.menuItemId=='open-linked-images'?true:false);
	
//	App.setStatus("opentabs","Opening tabs...");
	if (info.menuItemId=='download-tabs' || info.menuItemId=='open-tabs' || linkedImages){
		browser.tabs.executeScript(
			tab.id,{
				file : '/parselinks.js',
				runAt: 'document_end'
			}).then(function(){
				var sendData={
					"needDownload":needDownload,
					"linkedImages":linkedImages
				};
				App.sendTabMessage(tab.id, "sendLinksBack", sendData).then(
					function(data){
						App.openTabs(data.links,data.needDownload,linkedImages);	
					}
				)
			},function(error){
				console.log("Attaching content script failed" + error);
		//		App.setStatus("default");
			});
	}else if (info.menuItemId=='one-click-mode'){
		App.settings.oneClickMode = info.checked;
		if (info.checked){
			browser.browserAction.setPopup({popup: ""});	
		}else{
			browser.browserAction.setPopup({popup: "popup/settings.html"});	
		}
		App.resetBadgeText();		
		App.setSettings();
		//App.updateIcon();
	}else if (info.menuItemId=='one-link'){
		App.openTabs([info.linkUrl],true);
	}
	else{
		App.getTabs().then(function(){
			let prev = App.settings.whichTabs;
			App.settings.whichTabs=info.menuItemId;
			App.startDownload();
			App.settings.whichTabs=prev;
		},function(error){
			console.log("error getting tabs " + error);
		});
	}
});


function mainIconClicked(){
	if (App.settings.oneClickMode){
		App.getTabs().then(function(){
			App.startDownload();
		},function(error){
			console.log("error getting tabs " + error);
		});	
	}
}

browser.browserAction.onClicked.addListener(mainIconClicked);


App = {
	
	settings : {
		downloadPath : '',
		whichTabs : 'right',
		minSizeLandscape: {
			'width':100,
			'height':56
		},
		minSizePortrait: {
			'width':56,
			'height':100
		},
		parralelDownloads: 5,
		maxRetries: 2,
		onlyLargestImage: true,
		closeTabs : true,
		autoOpenDownloads : false,
		oneClickMode:false
	},
	
	sendMessage : function(action,data){
		return new Promise(function(resolve, reject){
			if (typeof data=='undefined'){
				data={};
			}
			browser.runtime.sendMessage({
				'action':action,
				'data':data
			}).then(resolve,
			function(){
				if (debug){
					//console.log("Background sendMessage Error "+err)	
				}
				resolve();
			});

			
		});
	},
	
	sendTabMessage : function(tabId,action,data){
		return new Promise(function(resolve, reject){
			if (typeof data=='undefined'){
				data={};
			}
			browser.tabs.sendMessage(tabId,{
				'action':action,
				'data':data
			}).then(resolve,
			function(){
				//console.log("Background sendTabMessage Error "+err)	
				resolve();
			});
			
		});
	},	
	status:{
		'action':'ready',
		'text': 'Ready for action!'
	},
	
	/*updateIcon(){
		if (App.settings.oneClickMode){
			browser.browserAction.setIcon({path:{
				"48":"icons/download_icon48_version_oneclick.png"
			}
			});
		} else{
			browser.browserAction.setIcon({path:{
				"48":"icons/download_icon48_version.png"
			}
			});
		}
	},*/
	
	resetBadgeText : function(){
		var ccolor = '#317290';
		var ctext = "←"//(App.settings.whichTabs.charAt(0).toUpperCase());
		//var l=App.settings.whichTabs.charAt(0).toUpperCase();
		switch (App.settings.whichTabs){
			case "active":
				ctext='↓'
				break;
			case "right":
				ctext='→';
				break;
				
		}
		if (App.settings.oneClickMode){
			App.setBadgeText(ctext,ccolor);
		} else{
			App.setBadgeText("");
		}
	},
	
	init : function(){
		//App.setSettings();
		App.loadSettings().then(function(){
			if ( App.settings.oneClickMode ){
				browser.contextMenus.update("one-click-mode",{"checked":true});
			}else{
				browser.browserAction.setPopup({popup: "popup/settings.html"});	
			}
			App.resetBadgeText();
		});
		App.setStatus(App.status.action, App.status.text, false);//this.saveSettings();
		browser.runtime.onMessage.addListener(App.executeAction);
	},
	
	setSettings : function(){
		var settings = App.settings
		browser.storage.local.set( {settings} );		
		if (debug){
			console.log('saving settings')
			console.log(settings)
		}
	},
	
	loadSettings : function(){
		return new Promise(function(resolve, reject){ 
			browser.storage.local.get()
			.then(function(res){
				if ( res.settings ){
					if (debug){
						console.log('setting settings')
						console.log(res.settings)
					}
					App.settings = res.settings;
				}else{
					App.setSettings();
				}
				resolve();
			},resolve);	
		});
	},
	
	updateObjValues : function (obj, updateObj){
		for (var p in updateObj) {
			if( obj.hasOwnProperty(p) && updateObj.hasOwnProperty(p)) {
				obj[p] = updateObj[p]
			}
		}
	},
	
	updateSettings : function(settings){
		if (debug){
			console.log("updateSettings before");
			console.log(App.settings);
		}
		
		App.updateObjValues(App.settings, settings)
		
		if (debug){
			console.log("updateSettings after");
			console.log(App.settings);
		}
		App.setSettings();
	},
	
	
	setStatus : function(ac,text,send){
		var send=(send==undefined?true:false);
		
		if (ac == "default"){
			App.status.action = 'ready';
			App.status.text = 'Ready for action!';
		}else{
			App.status.action = ac;
			App.status.text = text;
		}
		var status = App.status;
		browser.storage.local.set( {status} );		
		if (debug){
			console.log('saving status');
			console.log(status);
		}
		
		if (send){
			App.sendMessage("setStatus",App.status);
		}
		
	},
	
	tabsLeft:[],
	tabsRight:[],
	tabsContext:[],
	activeTab:{},
	
	getTabs : function(){
		return new Promise(function(resolve, reject){
			if ( App.downloadStarted ){
				resolve({
					'tabsLeftCount':App.tabsLeft.length,
					'tabsRightCount':App.tabsRight.length
				});	
				return;
			}
			App.tabsLeft=[];
			App.tabsRight=[];
			browser.tabs.query({
				currentWindow : true,
				active : true
			}).then(function(tabs){
				App.activeTab = tabs[0];
				if (debug){
					console.log("active tab index:" + App.activeTab.index)
				}
			}).then(function(){
				browser.tabs.query({
					currentWindow : true,
					active : false,
					pinned : false
				}).then(function(tabs){
					for (var i=0; i<tabs.length; i++){
						var tab = tabs[i];
						if ( tab.index>App.activeTab.index ){
							App.tabsRight.push(tab);
						}else{
							App.tabsLeft.push(tab);
						}
					}
			
					if (debug){
						console.log("tabs count:" + App.tabsLeft.length+' '+App.tabsRight.length)
					}
			
					resolve({
						'tabsLeftCount':App.tabsLeft.length,
						'tabsRightCount':App.tabsRight.length
					});
				})
				
			});

		});
	},
	
	
	/*notificationId: 'downloadimages'+Math.random() * (900000 - 100000) + 100000,
	
	notification : function(text){
		return new Promise(function(resolve, reject){
			browser.notifications.create({
				"type": "basic",
				"iconUrl": browser.extension.getURL("icons/page-32.png"),
				"title": 'Wortless messages inc.',
				"message": text
			}).then(function(){
				resolve();
			});
		});
	},*/
	
	downloadStarted:0,
	reservedDownloadItem:false,
	
	resetDownload : function(){
		clearTimeout(App.badeTextTimeout);
		App.downloadStarted = 1;
		App.tabsDownloadQueue = [];
		App.tabsDownloadQueueUpdate = [];
		App.imagesDownloadQueue = [];
		App.imagesDownloadQueueUpdate = [];
		App.reservedDownloadItem = false;
		App.cancelCurTimeout = 0;
		App.cancelImagesArr = [];
		App.downloadTabsCount = 0;
		App.downloadCurTimeout = 0;
		App.retryObj = {};
		App.downloadStats = {
			downloaded:0,
			failed:0,
			total:0
		};
	},
	
	getIndexById : function(id){
		for ( var i=0; i<App.tabsDownloadQueue.length; i++ ){
			if ( App.tabsDownloadQueue[i].id==id ){
				return i;
			}
		}
		return false;
	},
	
	isLinkedImage : function(url){
			var ext = url;
			var imgExts = ['jpg','jpeg', 'png', 'gif', 'tif', 'tiff' ,'psd', 'svg' , 'bmp' , 'ico'];
			
			if ( ext.indexOf('.')==-1 ){
				return false;
			}
			
			ext = url.split('.').pop().toLowerCase();
			
			
			if ( ext.indexOf('?')!=-1 ){
				ext = url.split('?')[0];
			}
		
			if ( ext.indexOf('#')!=-1 && ext.indexOf('#') > ext.indexOf('.') ){
				ext = url.split('#')[0];
			}
			
			if (imgExts.indexOf(ext)==-1){
				return false;
			}
			
			return true;
	},
	
	getFileName : function(url){
		var fn = url;
		if ( url.indexOf('?')!=-1 ){
			fn = url.split('?')[0];
		}
		
		if ( url.indexOf('#')!=-1 && url.indexOf('#') > fn.indexOf('.') ){
			fn = url.split('#')[0];
		}
		
		fn = fn.split('/');
		fn = fn[ fn.length-1 ];
		if ( !fn.length ){
			fn = 'img';
		}
		
		if ( fn.indexOf('.')==-1 ){
			fn+='.jpg';
		}
		
		return (App.settings.downloadPath?App.settings.downloadPath+'/'+fn:fn);
		
	},
	
	getIndexByDlId : function(id){
		
		for ( let i=0; i<App.imagesDownloadQueue.length; i++ ){
			if ( App.imagesDownloadQueue[i].downloadItem!==undefined && App.imagesDownloadQueue[i].downloadItem.id==id ){
				return i;
			}
		}
		return false;

	},
	
	formatDownloadStatus : function(){
		var txt = ("Downloaded: "+ App.downloadStats.downloaded
			+" of "+( App.downloadStats.total? App.downloadStats.total : '?')+' pics'
			+(App.downloadStats.failed ? ", failed: "+App.downloadStats.failed:""))
			+".<br>Tabs parsed: " + App.downloadTabsCount
		return txt;
	},
	
	
	isImageDup : function(url){
		for (let i=0;i<App.imagesDownloadQueue.length;i++){
			if (App.imagesDownloadQueue[i].url.toLowerCase()==url.toLowerCase()){
				return true;
			}
		}
		for (let i=0;i<App.tabsDownloadQueue.length;i++){
			let elTab = App.tabsDownloadQueue[i];
			if ( typeof elTab.images=="undefined" || !elTab.images.length ){
				continue;
			}
			
			for (let j=0;j<elTab.images.length;j++){
				if (elTab.images[j].url.toLowerCase()==url.toLowerCase()){
					return true;
				}
			}
			
		}
		
		return false;
	},
	
	downloadTimeout:"",
	
	download : function(){
		//canceled
		var delay = 300;
		var maxTimeout = 300000;
		
		if ( !App.downloadStarted ){
			return;
		}
		
		if ( !App.tabsDownloadQueue.length && !App.imagesDownloadQueue.length){
			if (App.downloadStats.downloaded==0 && App.downloadStats.total==0){
				App.setStatus('ready', 'No images have been saved. Ready for more!');
			}else{
				App.setStatus('ready', App.formatDownloadStatus()+'. Ready for more!');
			}
			App.downloadStarted = 0;
			/*for (let i=0;i<App.cancelImagesArr.length;i++){
				let elImage = App.cancelImagesArr[i];
				browser.downloads.erase({id:elImage.downloadItem.id}).then(function(){},function(error){})
			}*/
//			App.sendMessage('setStatus',App.status);
			App.setBadgeText(App.downloadStats.downloaded.toString(),'green');
			App.setDelayedBadgeText("",'',4000);
			if ( App.settings.autoOpenDownloads ){
				App.showDownloads();
			}
			return;
		}
		
		if (App.status.action!='canceling' && App.status.text!=App.formatDownloadStatus()){
				App.setStatus('downloading', App.formatDownloadStatus());
			//App.sendMessage('setStatus',App.status);
				App.setBadgeText(App.downloadStats.downloaded.toString());
		}
		
		if (debug){
			console.log("Download Iteration");
//			console.log(App.imagesDownloadQueue);
		}
		
		//update from update Queue tabs
		//for (let i=0;i<App.tabsDownloadQueueUpdate.length;i++){
		while (App.tabsDownloadQueueUpdate.length){
			let elTabUpd = App.tabsDownloadQueueUpdate.shift();
			let index = App.getIndexById(elTabUpd.id);
			if (index === false){
				continue;
			}
			
			let elTab = App.tabsDownloadQueue[index];
			if ( typeof elTabUpd.images!="undefined" && elTabUpd.images.length ){
				
				for (let i=0;i<elTabUpd.images.length; i++){
					if ( App.isImageDup(elTabUpd.images[i].url) ){
						elTabUpd.images.splice(i,1);
						i--;
					}
				}
				
				App.downloadStats.total += elTabUpd.images.length;
			}
			
			if (elTabUpd.status=='parsed'){
				App.downloadTabsCount++;
				if ( App.settings.closeTabs ){
					browser.tabs.remove(elTab.id);
				}

			}
			App.updateObjValues(elTab,elTabUpd);
		};
		
		
		
		//update imagesDownloadQueueUpdate
		
		while ( App.imagesDownloadQueueUpdate.length ){
			let elImageUpd = App.imagesDownloadQueueUpdate.shift();
			let index = App.getIndexByDlId(elImageUpd.downloadItem.id);

			if (index === false){
				continue;
			}
			if (debug){
				console.log('updating image element');
				console.log(elImageUpd);
			}
			
			let elImage = App.imagesDownloadQueue[index];
			
			App.updateObjValues(elImage,elImageUpd);
			
		}
/*		for (let i=App.imagesDownloadQueue.length-1;i>=0;i--){
			let elImage = App.imagesDownloadQueue[i];
			
		}*/
		
		for (let i=0;i<App.imagesDownloadQueue.length;i++){
			
			if(debug){
				//console.log("imagesDownloadQueue iterate")
				//console.log(App.imagesDownloadQueue);
			}
			
			
			var elImage = App.imagesDownloadQueue[i];
/*			if (typeof elImage.downloadItem!="undefined"){
				App.checkDownloadState(elImage);
			}*/
			if (elImage.status=='complete'){
				App.downloadStats.downloaded++; 
				App.cancelImagesArr.push(JSON.parse(JSON.stringify(elImage)));
				App.imagesDownloadQueue.splice(i,1);
				i--;
				continue;
			}else if (elImage.status=='failed'){
				App.downloadStats.failed++; 
				App.imagesDownloadQueue.splice(i,1);
				i--;
				continue;
			}else			
			if ( elImage.status=='ready' ){
				elImage.status = "downloading";
				browser.downloads.download({
					filename : App.getFileName(elImage.url),
					//headers : [{'name':'Referer','value':elImage.referer}],
					saveAs : false,
					url : elImage.url
				}).then((function(elImage){
					return function(itemId){
					
//					browser.downloads.search({id:itemId,'limit':1}).then(function(items){
						if (!App.downloadStarted){
							//browser.downloads.cancel(itemId).then(function(){},function(error){})
							//browser.downloads.erase({id:itemId}).then(function(){},function(error){})
							App.cancelRemoveErase(itemId);
						}
						
						if ( App.retryObj[elImage.url]==undefined ){
							App.retryObj[elImage.url]=0;
						}
						elImage.downloadItem = {id:itemId};
						if (debug){
							console.log("Added download item");
							console.log(elImage);
						}
					//});
					}
				})(elImage), function(error){
					console.log("Can't add download item "+error);
					elImage.status = 'failed';
					//App.retryDownload(elImage);
				});
			}
			
		}
		
		App.downloadCurTimeout+=delay;
		
		if ( App.imagesDownloadQueue.length>=App.settings.parralelDownloads ){
			App.downloadTimeout = setTimeout(App.download,delay);
			return;
		}
		
		for (let i=0;i<App.tabsDownloadQueue.length;i++){
			
			var elTab = App.tabsDownloadQueue[i];
			
			
			
			if (elTab.status != 'parsed'){
				
				if (App.downloadCurTimeout>maxTimeout){
					elTab.status = 'parsed';
				}else{
					continue;
				}
			}
			
			if ( !elTab.images.length ){
//					elTab.status='removed';
				App.tabsDownloadQueue.splice(i,1);
				i--;
				continue;
			}
			
			
			while (App.imagesDownloadQueue.length<App.settings.parralelDownloads && elTab.images.length){
				App.imagesDownloadQueue.push(elTab.images.shift());	
				if (debug){
					console.log("Adding images to q");
					console.log(App.imagesDownloadQueue)
				}

			}
			

			
		}
		
		//clear removed tabs
		/*for (let i=App.tabsDownloadQueue.length-1;i>=0;i--){
			if ( App.tabsDownloadQueue[i].status=='removed' ){
				if (debug){
					console.log("removing tab")
				}
				App.tabsDownloadQueue.splice(i, 1);
			}
		}*/
		
		App.downloadTimeout = setTimeout(App.download,delay);
	},
	
	
	
	retryDownload : function(downloadId){
		var el = {'downloadItem':{id:downloadId}};
		
		browser.downloads.search({id:downloadId, limit:1}).then(function(items){
			if (!items.length){
				el.status='failed';
				App.imagesDownloadQueueUpdate.push(el);	
				return;
			}
			let downloadItem = items[0];
			
			if (App.retryObj[downloadItem.url]==undefined){
				el.status = 'failed';
				browser.downloads.erase({id:downloadId});
				App.imagesDownloadQueueUpdate.push(el);
				if (debug){
					console.log("Download of item failed no url");
					console.log(el);
				}
				
				return;
			}
		
			let retry = App.retryObj[downloadItem.url];
		
			if ( retry < App.settings.maxRetries ){
				el.status = 'ready';
				App.retryObj[downloadItem.url] = retry+1 ;
			}else{
				el.status = 'failed';
			}		
			if (debug){
				console.log("Download of item failed normal retry" + (retry));
				console.log(el);
			}
			browser.downloads.erase({id:downloadId});
			App.imagesDownloadQueueUpdate.push(el);
		
		},function(){
			if (debug){
				console.log("Download of item failed no retry");
				console.log(el);
			}
			el.status='failed';
			browser.downloads.erase({id:downloadId});
			App.imagesDownloadQueueUpdate.push(el);			
		});
		
	},
	
	
	downloadsChanged : function(downloadItem){
/*		let index = App.getIndexByDlId(downloadItem.id);
		if ( index === false ){
			return;
		}*/
		if (debug){
				console.log("Updated download item");
				console.log(downloadItem);
				//return;
		}
		
		//var downloadItem=elImage.downloadItem;
		
		var elImage = {
			'status':'downloading',
			'downloadItem':{id:downloadItem.id}
		};
		
		if (downloadItem.error!== undefined
		|| (downloadItem.state!== undefined && downloadItem.state.current=='interrupted')
		|| (downloadItem.paused !==undefined && downloadItem.canResume!==undefined && !downloadItem.canResume.current ) ){
			App.retryDownload(downloadItem.id);
			if (debug){
				console.log("Retry");
				console.log(downloadItem);
			}
			return;
		}
		
		if ( downloadItem.paused !== undefined && downloadItem.paused.current ){
			browser.downloads.resume(downloadItem.id);
			if (debug){
				console.log("Unpausing item");
				console.log(downloadItem);
			}
			
			return;
		}
		
		if ( downloadItem.state!== undefined && downloadItem.state.current=='complete' ){
			if (debug){
				console.log("Finished downloading item");
				console.log(downloadItem);
			}
			
			elImage.status = 'complete';
			
//			App.retryDownload(downloadItem.id);
			//return;
			
/*			if ( !App.reservedDownloadItem ){
				App.reservedDownloadItem = downloadItem.id;
			}else{
				browser.downloads.erase({id:downloadItem.id});
			}*/
			//browser.downloads.erase({id:downloadItem.id});
		}
		
		if (debug){
			console.log("Pushed image to update que");
			console.log(elImage);
		}
		App.imagesDownloadQueueUpdate.push(elImage);
		
	},
	
	
	executeTabScript : function(tab,elTab){
		browser.tabs.executeScript(
			tab.id,{
				file : '/downloadimage.js',
				runAt: 'document_end'
			}).then(function(){
				
			},function(error){
				console.log("Attaching content script failed " + error);
				elTab.status = 'parsed';
				App.downloadTabsCount++;
			});	
	},
	
	startDownload : function(context){
		if (App.downloadStarted){
			return;
		}
		App.setStatus("parsing", "Parsing images from tabs...");
		//App.sendMessage("setStatus", App.status);
		App.resetDownload();
		var arr = [];
		switch (App.settings.whichTabs){
			case 'left':
				arr = App.tabsLeft;
				break;
			case 'active':
				arr.push(App.activeTab);
				break;
			case 'right':
				arr = App.tabsRight;
			
				break;
			
		}	
		
		if (context!==undefined){
			arr = App.tabsContext;	
		}
		
		for (let i=0;i<arr.length;i++){
			var tab = arr[i];
			App.tabsDownloadQueue.push({
				'id':tab.id,
				'status':'added',
				'images':[]
			});
			
			var elTab = App.tabsDownloadQueue[App.tabsDownloadQueue.length-1];
			if (tab.discarded){
				if (debug){
					console.log("Tabs are unloaded");
				}
				browser.tabs.update(tab.id,{url: tab.url})
				.then(function(tab,elTab){
					return function(tabnew){
						setTimeout(function(){
							App.executeTabScript(tabnew,elTab);
						},1500);
					}
				}(tab,elTab),function(tab,elTab){
					return function(){
						App.executeTabScript(tab,elTab);
					}
				}(tab,elTab)
				);
			}else{
				App.executeTabScript(tab,elTab);	
			}
			
		};
//		App.downloadTabsCount=App.tabsDownloadQueue.length;
		browser.downloads.onChanged.removeListener(App.downloadsChanged);
		browser.downloads.onChanged.addListener(App.downloadsChanged);
		setTimeout(App.download,0);
		
		if (debug){
			console.log('Added tabs for download');
			console.log(App.tabsDownloadQueue);
		}
	},
	
	cancelCurTimeout:0,
	
	
	cancelRemoveErase : function(id){
		
			browser.downloads.cancel(id)
			.then(
			function(){
				browser.downloads.removeFile(id)
			},
			function(){
				browser.downloads.removeFile(id)
			}).then(
			function(){
				browser.downloads.erase({"id":id})
			},
			function(){
				browser.downloads.erase({"id":id})
			})
		
	},
	
	cancelDownloads : function(){
		var maxT = 3000;
		var timeout = 300;
		var needMoreTime = 0 ;
		App.setStatus("canceling","Canceling in progress...");
		//App.sendMessage("setStatus",App.status);
		App.openTabsArr =[];
		App.tabsContext =[];
		App.downloadStarted = 0;
		browser.downloads.onChanged.removeListener(App.downloadsChanged);
		try{
			clearTimeout(App.downloadTimeout);
		}catch(err){
			
		}
		
		for (let i=0;i<App.tabsDownloadQueue.length;i++){
			if (typeof App.tabsDownloadQueue[i]=="undefined"){
				continue;
			}
			let elTab = App.tabsDownloadQueue[i];
			if (elTab.status=='attached'){
				elTab.status='removed';
				App.sendTabMessage(elTab.id,'cancel');
				needMoreTime = 1;
			}else if (elTab.status=='added'){
				needMoreTime = 1;	
			}
		}
		
		
		for (let i=0;i<App.imagesDownloadQueue.length;i++){
			var elImage = App.imagesDownloadQueue[i];
			if (typeof elImage.downloadItem!=="undefined"){
				//browser.downloads.search({"id":elImage.downloadItem.id,'limit':1}).then(function(items){
					if (debug){
						console.log("Canceling downloads item");
						console.log(elImage);
						//console.log(items);
					}
					App.cancelRemoveErase(elImage.downloadItem.id);
			}
		}
		
		for (let i=0;i<App.cancelImagesArr.length;i++){
			var elImage = App.cancelImagesArr[i];
			if (debug){
				console.log("Removing item from disk");
				console.log(elImage);
			}
			
			App.cancelRemoveErase(elImage.downloadItem.id);
			
		}
		

//		App.tabsDownloadQueue=[];
		//App.tabsDownloadQueueUpdate=[];
		
		if (needMoreTime && App.cancelCurTimeout<maxT){
			setTimeout(function(){
				App.cancelDownloads();
			},timeout);
		}else{
			App.setStatus("default");
			App.resetBadgeText();
			//App.setBadgeText("");
//			App.sendMessage("setStatus",App.status);
			//callBack();
		}
		App.cancelCurTimeout+=timeout;
	},
	
	showDownloads : function(){
		/*if (App.reservedDownloadItem){
			browser.downloads.search({exists:true,id:App.reservedDownloadItem,limit:1})
			.then(function(items){
				if (items.length){
					browser.downloads.show(App.reservedDownloadItem)
					.then(function(){},function(){
						browser.downloads.showDefaultFolder();
					});
				}else{
					browser.downloads.showDefaultFolder();
				}
			},function(){
				browser.downloads.showDefaultFolder();
			});
		}else{
			browser.downloads.showDefaultFolder();
		}	*/	
		browser.downloads.showDefaultFolder();
	},
	
	setBadgeText:function(text,color){
		clearTimeout(App.badgeTextTimeout);
		if ( color == undefined ){
			color = '#aaaaaa';
		}
		browser.browserAction.setBadgeText({"text":text});
		browser.browserAction.setBadgeBackgroundColor({"color":color});
	},
	
	badgeTextTimeout:'',
	
	setDelayedBadgeText(text,color,delay){
		App.badeTextTimeout=setTimeout(function(){
			if (App.settings.oneClickMode){
				App.resetBadgeText();
				//App.setBadgeText(text,color);
			}
			else{
				App.setBadgeText(text,color);
			}
		},delay);
	},
	
	
	waitForTabsToOpenCurTimeout:'',
	
	waitForTabsToOpen : function(needDownload){
		var delay = 300;
		var allOpened = true;
		
		for (let i=0;i<App.openTabsArr.length;i++){
			if (App.openTabsArr[i].status=='added'){
				allOpened = false;
				break;
			}
		}
		
		if (allOpened){
			if (needDownload){
				while (App.openTabsArr.length){
					let elT = App.openTabsArr.shift();
					if (elT.status=='created'){
						App.tabsContext.push(elT.tab);
					}
					
				}
				App.startDownload(true);
			}
			else{
				App.setStatus("default");
			}
		}else{
			setTimeout(function(){
				App.waitForTabsToOpen(needDownload);
			},delay);
		}
		
	},
	
	openTabsArr:[],
	
	openTabs : function(links,needDownload,linkedImages){
		if (App.downloadStarted || !links){
			return;
		};
		
		if (linkedImages){
			for ( let i=0;i<links.length;i++ ){	
				if ( !App.isLinkedImage(links[i]) ){
					links.splice(i,1);
					i--;
				}
			}
		}
		
		if (!links){
			return;
		}
		
		if (needDownload){
			App.setStatus("opentabs","Opening and downloading "+links.length+' tabs...');
		}else{
			App.setStatus("opentabs","Opening "+links.length+' tabs...');
		}
		
		if (debug){
			console.log("oppening tabs "+needDownload);
			console.log(links);
		}
		
		App.tabsContext=[];
		App.openTabsArr=[];
		
		for ( let i=0;i<links.length;i++ ){
			let l = links[i];
			App.openTabsArr.push({'link':l,status:'added'});
			var tabObj=App.openTabsArr[App.openTabsArr.length-1];
			browser.tabs.create({
				active:false,
				url:l
			}).then(function(tabObj){
				return function(tab){
					tabObj.status='created';
					tabObj.tab=tab;
				}
			}(tabObj),function(tabObj){
				return function(){
					tabObj.status='error';
					console.log("Opening new tab failed");
				}
			}(tabObj))
		}
		
		App.waitForTabsToOpen(needDownload);
		

	},
	
	executeAction : function (message, sender, sendResponse){
		var action = message.action;
		var data = message.data;
		if (debug){
			console.log("Recived message");
			console.log(message);
		}
		switch (action){
			case 'updateTabsDownloadQueue': 
				data.id = sender.tab.id;
				if (debug){
					console.log("background received images info");
					console.log(data);
				}
				App.tabsDownloadQueueUpdate.push(data);
				break;
				
			case 'showDownloads': 
				App.showDownloads();
				break;

			case 'updateSettings': 
				App.updateSettings(data.settings);
				break;

			/*case 'openTabs': 
				App.openTabs(data.links,data.needDownload);
				break;*/

				
			case 'getSettings': 
				var settings = App.settings;
				sendResponse({settings});
				break;
				
			case 'getStatus': 
				var status = App.status;
				sendResponse({status});
				break;

			case 'cancelDownloads': 
				App.cancelDownloads()
				//return true;
				break;
				
			case 'startDownload': 
				App.startDownload();
				break;
			case 'updateIcon': 
				break;
					
			case 'getTabs': 
				App.getTabs().then(function(data){
					if (debug){
						console.log("Sending responce getTabs");
					}
					sendResponse(data);
				});
				return true;
				break;
				
		}
	}
	
}


App.init();





