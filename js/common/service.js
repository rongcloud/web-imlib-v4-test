(function(win) {
  var RongIMLib = win.RongIMLib,
    RongIM = win.RongIM,
    RongIMClient = RongIMLib.RongIMClient,
    utils = RongIM.Utils;

  var im;

  // var sendMsgTimeout = RongIM.config.isDebug ? 300 : 0;

  var selfUserId;

  // 缓存消息, 用作撤回、删除等操作的参数
  var CacheMsg = {
    eventEmitter: new utils.EventEmitter(),
    _list: [],
    set: function (msg) {
      this._list.push(msg);
      this.eventEmitter.emit('msgChanged');
    },
    remove: function (msg) {
      var list = this._list;
      utils.forEach(list, function(child, index) {
        if (child.messageUId === msg.messageUId) {
          list.splice(index, 1);
        }
      }, { isReverse: true });
      this.eventEmitter.emit('msgChanged');
    },
    getLast: function () {
      var list = this._list, length = list.length;
      var msg = {};
      if (length) {
        msg = list[length - 1];
      }
      return msg;
    }
  };

  /**
   * 初始化以及链接
   * @param {object} config 
   * @param {string} config.appkey 融云颁发的 appkey
   * @param {string} config.token 融云颁发的 token(代表某一个用户)
   * @param {Object} watcher 
   * @param {Object} watcher.status 监听链接状态的变化
   * @param {Object} watcher.message 监听消息的接收
   */
  function init(config, watcher) {
    watcher = watcher || {};
    config = utils.clearUndefKey(config);
    config = utils.copy(config);
    var navi = config.navi;
    if (config.isPolling) {
      config.connectType = 'comet';
    }
    if (navi) {
      var navigators;
      navi = navi.replace(/\s/g, '');
      if (navi.indexOf(',') !== -1) {
        navigators = navi.split(',');
      } else {
        navigators = [navi];
      }
      config.navigators = navigators;
    }
    config.logLevel = 0
    // config.customCMP = ['120.92.13.84:80']
    // config.isDebug = true;
    im = RongIMLib.init(config);
    RongIM.Service.im = im;
    im.watch({
      conversation: function (event) {
        console.log('watch conversation', event.updatedConversationList[0].lastUnreadTime);
        lastUnreadTime = event.updatedConversationList[0].lastUnreadTime
        //watcher.conversation(event)
      },
      message: function (event) {
        var message = event.message;
        var hasMore = event.hasMore;
        watcher.message(message);
        console.warn('received messages', event);
        // message.xxx.xxx;
      },
      status: function (event) {
        var status = event.status;
        console.log('status changed', event);
        // 不处理的状态码
        var unHandleStatus = [];
        if (unHandleStatus.indexOf(status) === -1) {
          watcher.status(status);
        }
      },
      chatroom: function (event) {
        console.warn('chatroom', event);
        // var updatedEntries = event.updatedEntries;
        watcher.chatroom(event);
        console.log('rejoin chatroom', event);
      },
      expansion: function(event) {
        console.warn('----msg expansion----', event);
        watcher.expansion(event);
      },
      typingStatus: function(event) {
        console.warn('watch typingStatus', event);
        watcher.typingStatus(event);
      },
      // 监听数据是否更新完毕
      pullFinished: function() {
        console.warn('离线数据加载完毕');
        watcher.pullFinished();
      },
      tag: function(event){
        console.warn('watch tag', event);
        watcher.tag(event);
      },
      messageBlocked: function(event) {
        watcher.messageBlocked(event)
      }
    });
    if(!config.customCMP){
      delete config.customCMP;
    }
    
    return im.connect(config);
  }

  /**
   * 断开链接
   * 文档: https://docs.rongcloud.cn/im/imlib/web/connect/#disconnect
   */
  function disconnect() {
    return im.disconnect();
  }

  function changeUser(config) {
    return im.changeUser(config);
  }

  function getConnectedTime() {
    return Promise.resolve(im.getConnectedTime()) 
  }

  /**
   * 重新链接
   * 文档: https://docs.rongcloud.cn/im/imlib/web/connect/#reconnect
   */
  function reconnect() {
    return im.reconnect();
  }

  /**
   * 获取会话列表
   * 文档: https://docs.rongcloud.cn/im/imlib/web/conversation/get-list/
   *
   * @param {number} count 获取会话的数量
   * @param {number} startTime 获取起始时间	
   * @param {number} order 获取顺序
   */
  function getConversationList(count, startTime, order) {
    return im.Conversation.getList({
      count: count,
      startTime: startTime,
      order: order
    });
  }

  /**
   * 删除会话列表
   * 文档: https://docs.rongcloud.cn/im/imlib/web/conversation/remove/
   */
  function removeConversation(conversationType, targetId) {
    conversationType = Number(conversationType);
    return im.Conversation.remove({
      type: conversationType,
      targetId: targetId
    });
  }

  /**
   * 获取历史消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-list/get-list/
   * 
   * @param {number} timestrap 时间戳
   * @param {number} count 数量
   */
  function getHistoryMessages(timestrap, count, conversationType, targetId, order) {
    conversationType = Number(conversationType);
    count = Number(count);
    timestrap = Number(timestrap);
    
    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.getMessages({
      timestamp: timestrap,
      count: count,
      order
    });
  }

  /**
   * 按时间删除历史消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-list/remove-list/#_1
   *
   * @param {number} timestrap 时间戳
   */
  function clearHistoryMessages(timestamp, conversationType, targetId) {
    conversationType = Number(conversationType);
    timestamp = Number(timestamp);
    
    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.clearMessages({
      timestamp,
    });
  }

  /**
   * 按消息删除历史消息
   * @param {string} messageUId 消息在 server 的唯一标识
   * @param {number} sentTime 消息发送时间
   * @param {number} messageDirection 消息方向
   */
  function deleteRemoteMessages(messageUId, sentTime, messageDirection, conversationType, targetId) {
    var lastMsg = CacheMsg.getLast() || {};
    conversationType = Number(conversationType) || lastMsg.type;
    sentTime = Number(sentTime) || lastMsg.sentTime;
    messageDirection = Number(messageDirection) || lastMsg.direction;
    
    var deleteMsg = { 
      messageUId: messageUId,
      sentTime: sentTime,
      messageDirection: messageDirection
    };
    var messages = [ deleteMsg ];

    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.deleteMessages(messages);
  }

  /**
   * 获取指定会话未读数
   * 文档: https://docs.rongcloud.cn/im/imlib/web/conversation/unreadcount/#get-one
   * 
   * @param {number} conversationType 会话类型
   * @param {string} targetId 目标 id (对方 id、群组 id、聊天室 id 等)
   */
  function getUnreadCount(conversationType, targetId) {
    conversationType = Number(conversationType);
    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.getUnreadCount()
  }

  /**
   * 获取所有会话未读数
   * 文档: https://docs.rongcloud.cn/im/imlib/web/conversation/unreadcount/#get-all
   */
  async function getTotalUnreadCount(conversationTypes, includeMuted) {
    let typeList = []
    if (conversationTypes.length > 0) {
      typeList = conversationTypes.split(',').map(i => Number(i))
    }
    return im.Conversation.getTotalUnreadCount(includeMuted, typeList);
  }

  /**
   * 清除指定会话未读数
   * 文档: https://docs.rongcloud.cn/im/imlib/web/conversation/unreadcount/#clear
   */
  function clearUnreadCount(conversationType, targetId) {
    conversationType = Number(conversationType);
    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.read();
  }

  /**
   * 设置会话草稿
  */
  function setDraft(conversationType, targetId, draft) {
    conversationType = Number(conversationType);
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).setDraft(draft)
  }

  /**
   * 获取会话草稿
  */
  function getDraft(conversationType, targetId) {
    conversationType = Number(conversationType);
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).getDraft()
  }

  /**
   * 删除会话草稿
  */
  function deleteDraft(conversationType, targetId) {
    conversationType = Number(conversationType);
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).deleteDraft()
  }

  function sendMessage(conversationType, targetId, msg) {
    conversationType = Number(conversationType);
    var conversation = im.Conversation.get({
      type: conversationType,
      targetId: targetId
    });
    return conversation.send(msg).then(function (msg) {
      CacheMsg.set(msg);
      return msg;
    });
  }

  /**
   * 发送文本消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#text
   * 注意事项:
   *    1: 单条消息整体不得大于128K
   *    2: conversationType 类型是 number，targetId 类型是 string
   * 
   * @param {string} text 文字内容
   * @param {number} conversationType 会话类型
   * @param {string} targetId 目标 id (对方 id、群组 id、聊天室 id 等)
   * @param {booleam} disableNotification 是否推送消息
   */
  function sendTextMessage(text, conversationType, targetId, isStatusMessage, disableNotification, canIncludeExpansion, exKeys, exVals, ...args) {
    var content = {
      content: text, // 文本内容
      user: {
        "id" : "user1",
        "name" : "张三",
        "portrait" : "https://cdn.ronghub.com/thinking-face.png"
      }
    };
    var expansion = {};
    var exKeysArr = exKeys.split(','), exValsArr = exVals.split(',');
    exKeysArr.forEach((item, idx) =>{
      expansion[item] = exValsArr[idx];
    })
    expansion = expansion || {key: 'value'}
    return sendMessage(conversationType, targetId, {
      content: content,
      messageType: 'RC:TxtMsg',
      isStatusMessage: isStatusMessage,
      disableNotification: disableNotification,
      canIncludeExpansion,
      expansion,
      pushConfig: {
        pushTitle: args[0],
        pushContent: args[1],
        pushData: args[2],
        disablePushTitle: args[3],
        forceShowDetailContent: args[4],
        iOSConfig: {
          threadId: args[5],
          apnsCollapseId: args[6],
          category: args[7],
          richMediaUri: args[8]
        },
        androidConfig: {
          notificationId: args[9],
          channelIdMi: args[10],
          channelIdHW: args[11],
          channelIdOPPO: args[12],
          typeVivo: args[13],
          googleConfig: {
            collapseKey: args[14],
            imageUrl: args[15],
            priority: args[16],
          }
        },
        templateId: args[17]
      }
    });
  }

  /**
   * 发送图片消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#image
   * 注意事项:
   *    1. 略缩图(content 字段)必须是 base64 字符串, 类型必须为 jpg
   *    2. base64 略缩图必须不带前缀
   *    3. base64 字符串大小不可超过 100 k
   *    4. 可通过 FileReader 或者 canvas 对图片进行压缩, 生成压缩后的 base64 字符串
   * imageUri 为上传至服务器的原图 url, 用来展示高清图片
   * 上传图片需开发者实现. 可参考上传插件: https://docs.rongcloud.cn/im/imlib/web/plugin/upload
   * 
   * @param {string} base64 图片 base64 缩略图
   * @param {string} imageUri 图片上传后的 url
   */
  function sendImageMessage(base64, imageUri, conversationType, targetId, disableNotification) {
    var content = {
      content: base64, // 压缩后的 base64 略缩图, 用来快速展示图片
      imageUri: imageUri // 上传到服务器的 url. 用来展示高清图片
    };
    return sendMessage(conversationType, targetId, {
      content: content,
      messageType: 'RC:ImgMsg',
      disableNotification
    });
  }

  /**
   * 发送文件消息
   * 文档：https://docs.rongcloud.cn/im/imlib/web/message-send/#file
   * 
   * @param {string} fileName 文件名
   * @param {string} fileSize 文件大小
   * @param {string} fileType 文件类型
   * @param {string} fileUrl 文件上传后的 url
   */
  function sendFileMessage(fileName, fileSize, fileType, fileUrl, conversationType, targetId, disableNotification) {
    var content = {
      name: fileName, // 文件名
      size: fileSize, // 文件大小
      type: fileType, // 文件类型
      fileUrl: fileUrl // 文件地址
    };
    return sendMessage(conversationType, targetId, {
      content: content,
      messageType: 'RC:FileMsg',
      disableNotification
    });
  }

  /**
   * 高质量语音消息: https://docs.rongcloud.cn/im/introduction/message_structure/#hqvoice_message
   * 注意事项:
   *   融云不提供声音录制的方法. remoteUrl 的生成需开发者实现
   * 
   * @param {string} remoteUrl 语音上传后的 url
   * @param {number} duration 语音时长
   */
  function sendVoiceMessage(remoteUrl, type, duration, conversationType, targetId, disableNotification) {
    var content = {
      remoteUrl: remoteUrl, // 音频 url, 建议格式: aac
      duration: duration, // 音频时长
      type: type
    };
    return sendMessage(conversationType, targetId, {
      content: content,
      messageType: 'RC:HQVCMsg',
      disableNotification
    });
  }

  /**
   * 撤回消息: https://docs.rongcloud.cn/im/imlib/web/message-send/#recall
   * 注意事项:
   *   消息撤回操作服务器端没有撤回时间范围的限制，由客户端决定
   *
   * @param {string} messageUId 撤回的消息 Uid
   * @param {number} sentTime 撤回的消息 sentTime
   */
  // BKE3-39Q0-4ME7-QRCS
  // 1599619898624
  function sendRecallMessage(messageUId, sentTime, conversationType, targetId, disableNotification, ...args) {
    var recallMsg;
    if (messageUId && sentTime && conversationType && targetId) {
      recallMsg = {
        messageUId: messageUId,
        sentTime: sentTime,
        disableNotification: disableNotification
      };
    } else {
      var lastMsg = CacheMsg.getLast() || {};
      recallMsg = lastMsg;
      recallMsg.disableNotification = disableNotification;
    }
    recallMsg.user = { // 携带用户信息
      "id" : "user1",
      "name" : "张三",
      "portrait" : "https://cdn.ronghub.com/thinking-face.png"
    }
    recallMsg.pushConfig = {
      pushTitle: args[0],
      pushContent: args[1],
      pushData: args[2],
      disablePushTitle: args[3],
      forceShowDetailContent: args[4],
      iOSConfig: {
        threadId: args[5],
        apnsCollapseId: args[6]
      },
      androidConfig: {
        notificationId: args[7],
        channelIdMi: args[8],
        channelIdHW: args[9],
        channelIdOPPO: args[10],
        typeVivo: args[11]
      },
      templateId: args[12]
    }
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId,
      
    }).recall(recallMsg);
  }

  function recallChatroomMessage(messageUId, sentTime, targetId, disableNotification) {
    var recallMsg;
    if (messageUId && sentTime && targetId) {
      recallMsg = {
        messageUId: messageUId,
        sentTime: sentTime,
        disableNotification: disableNotification
      };
    } else {
      var lastMsg = CacheMsg.getLast() || {};
      recallMsg = lastMsg;
      recallMsg.disableNotification = disableNotification;
    }
    recallMsg.user = {
      "id" : "user1",
      "name" : "张三",
      "portrait" : "https://cdn.ronghub.com/thinking-face.png"
    }
    return im.ChatRoom.get({
      id: targetId,
      
    }).recall(recallMsg);
  }

  /**
   * 发送 @ 消息(此处以文本消息举例)
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#example
   * 
   * @param {string} text 文字内容
   * @param {string} methiondId @ 对象的 id
   */
  function sendAtMessage(text, methiondId, conversationType, targetId, disableNotification) {
    conversationType = Number(conversationType);

    var isMentioned = true;

    var content = {
      content: text
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      content: content,
      messageType: 'RC:TxtMsg',
      isMentioned: isMentioned,
      mentionedUserIdList: [methiondId], // @ 人 id 列表
      mentionedType: 2,
      disableNotification
    });
  }

  //测试错误参数下发送 @  消息
  function sendAtMessageByErrorParamField(text, methiondId, conversationType, targetId, disableNotification) {
    conversationType = Number(conversationType);

    var isMentioned = true;

    var content = {
      content: text
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      content: content,
      messageType: 'RC:TxtMsg',
      isMentiond: isMentioned,
      mentiondUserIdList: [methiondId], // @ 人 id 列表
      mentiondType: 1,
      disableNotification
    });
  }

  /**
   * 注册自定义消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#custom
   *
   * @param {string} messageName 注册消息的 Web 端类型名
   * @param {string} messageType 注册消息的唯一名称. 注: 此名称需多端一致
   * @param {boolean} isCounted 是否计数
   * @param {boolean} isPersited 是否存储
   * @param {Array<string>} props 消息包含的字段集合
   */
  function registerMessage(messageType, isPersited, isCounted, props) {
    // var mesasgeTag = new RongIMLib.MessageTag(isCounted, isPersited); //true true 保存且计数，false false 不保存不计数。
    // props = props.split(','); // 将字符串截取为数组. 此处为 Demo 逻辑, 与融云无关
    // RongIMClient.registerMessageType(messageName, messageType, mesasgeTag, props);
    // 废弃此概念

    im.registerMessageType(messageType, isPersited, isCounted, props)
    return utils.Defer.resolve();
  }

  /**
   * 发送自定义消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#custom
   * 
   * @param {string} messageType 注册消息的 Web 端类型名
   * @param {*} props 消息包含的字段集合
   */
  function sendRegisterMessage(messageType, props, conversationType, targetId, disableNotification) {
    // props && (props = props.split(','))
    // props.forEach(item => {
    //   content[item] = item
    // })
    let content = JSON.parse(props);
    // const reg = /^{|}$/g
    // const regArr = /^\[|\]$/g
    // if (regArr.test(props)) {
    //   content = props.replace(regArr, '')
    //   content = content.split(',')
    // } else if (reg.test(props)) {
    //   let obj = {}
    //   let isoK = true
    //   content = props.replace(reg, '')
    //   content = content.split(',')
    //   content.forEach(item => {
    //     const newI = item.split(":")
    //     newI.length > 1 ? (obj[newI[0]] = newI[1]) : (isoK = false)
    //   })
    //   isoK ? (content = obj) : (content = props)
    // } else {
    //   content = props
    // }
    // console.log('content---', content)
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: messageType,
      content: {
        content
      },
      disableNotification
    });
  }

  /**
   * 发送位置消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#location
   * 注意事项:
   *   1. 缩略图必须是base64码的jpg图, 而且不带前缀"data:image/jpeg;base64,", 不得超过100K
   *   2. 需要开发者做显示效果, 一般显示逻辑: 图片加链接, 传入经纬度并跳转进入地图网站
   * 
   * @param {string} base64 位置缩略图
   * @param {number} latitude 维度
   * @param {number} longitude 经度
   * @param {string} poi 位置信息
   */
  function sendLocationMessage(base64, latitude, longitude, poi, conversationType, targetId, disableNotification) {
    var content = {
      latitude: latitude,
      longitude: longitude,
      poi: poi,
      content: base64
    };
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: 'RC:LBSMsg',
      content: content,
      disableNotification
    });
  }

  /**
   * 发送引用消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#location
   * 注意事项:
   * 
   * @param {string} referContent 引用消息内容
   * @param {number} referMsgUserId 引用消息用户 ID
   * @param {number} objName 引用消息类型
   * @param {string} content 消息内容
   */
  function sendReferenceMessage(referContent, referMsgUserId, objName, content, conversationType, targetId, disableNotification) {
    var content = {
      referMsg: {
        content: referContent
      },
      referMsgUserId: referMsgUserId,
      objName: objName,
      content: content,
    };
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: RongIMLib.MESSAGE_TYPE.REFERENCE,
      content: content,
      disableNotification
    });
  }

  /**
   * 发送富文本(图文)消息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#rich-content
   *
   * @param {string} title 图文标题
   * @param {number} content 图文内容
   * @param {number} imageUri 显示图片的 url(图片信息)
   * @param {string} url 点击图文后打开的 url
   */
  function sendRichContentMessage(title, content, imageUri, url, conversationType, targetId, disableNotification) {
    content = {
      title: title,
      content: content,
      imageUri: imageUri,
      url: url
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: 'RC:ImgTextMsg',
      content: content,
      disableNotification
    });
  }

  /**
   * 发送小视频消息
  */
  function sendSightMessage(conversationType, targetId, sightUrl, content, duration, size, name) {
    content = {
      sightUrl: sightUrl,
      content: content,
      duration: duration,
      size: size,
      name: name
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: 'RC:SightMsg',
      content: content
    });
  }

  /**
   * 发送typing消息
  */
  function sendTypingMessage(conversationType, targetId, typingContentType) {
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).sendTypingStatusMessage(typingContentType);
  }

  /**
   * 发送群回执请求消息
  */
  function sendReadReceiptRequestMessage (conversationType, targetId, messageUId ) {
    content = {
      messageUId
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: 'RC:RRReqMsg',
      content
    });
  }

  /**
   * 发送群回执响应消息
  */
  function sendReadReceiptResponseMessage(conversationType, targetId, messageUId, requestUserId) {
    content = {
      receiptMessageDic:{
        [requestUserId]: [messageUId]
      }
    };

    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).send({
      messageType: 'RC:RRRspMsg',
      content
    });
  }

  /**
  * 发送群回执响应消息（新）
 */
   function sendNewReadReceiptResponseMessage(targetId, messageUId) {
    messageUId = messageUId.split(',')
    return im.Conversation.get({
      type: 3,
      targetId: targetId
    }).sendReadReceiptMessage(messageUId)
  }

  // 获取已读列表
  function getMessageReader(targetId, messageUid) {
    return im.Conversation.get({
      type: 3,
      targetId: targetId
    }).getMessageReader(messageUid)
  }

  /**
   * 加入聊天室
   * 文档: https://docs.rongcloud.cn/im/imlib/web/chatroom/#join
   *
   * @param {string} chatRoomId 聊天室 id
   * @param {number} count 拉取消息数量
   */
  function joinChatRoom(chatRoomId, count) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).join({
      count: count
    });
  }

  /**
   * 加入已存在的聊天室
   * 文档: https://docs.rongcloud.cn/im/imlib/web/chatroom/#join
   *
   * @param {string} chatRoomId 聊天室 id
   * @param {number} count 拉取消息数量
   */
  function joinExistChatRoom(chatRoomId, count) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).joinExist({
      count: count
    });
  }

  /**
   * 退出聊天室
   * 文档: https://docs.rongcloud.cn/im/imlib/web/chatroom/#quit
   *
   * @param {string} chatRoomId 聊天室 id
   */
  function quitChatRoom(chatRoomId) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).quit();
  }

  /**
   * 获取聊天室信息
   * 文档: https://docs.rongcloud.cn/im/imlib/web/chatroom/#get
   *
   * @param {string} chatRoomId 聊天室 id
   * @param {string} count 获取人数
   * @param {string} order 排序方式
   */
  function getChatRoomInfo(chatRoomId, count, order) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).getInfo({
      count: count,
      order: order
    });
  }

  function getChatRoomHistoryMessages(chatRoomId, timestrap, count, order) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).getMessages({
      timestrap: timestrap,
      timestamp: timestrap,
      count: count,
      order: order
    });
  }

  function getFileToken(fileType, fileName) {
    return im.getFileToken(fileType, fileName)
  }

  function getFileUrl(fileType, fileName, originName) {
    return im.getFileUrl(fileType, fileName, originName)
  }

  /**
   * 发送聊天室消息(以文本消息为例)
   * 文档: https://docs.rongcloud.cn/im/imlib/web/message-send/#text
   *
   * @param {string} text 文字内容
   */
  function sendChatRoomMessage(text, targetId) {
    var content = {
      content: text // 文本内容
    };
    return im.ChatRoom.get({
      id: targetId
    }).send({
      messageType: 'RC:TxtMsg',
      content: content
    })
  }

  function setChatRoomEntry(key, value, isAutoDelete, isSendNotification, extra, chatRoomId) {
    var entry = {
      key: key,
      value: value,
      notificationExtra: extra,
      isAutoDelete: isAutoDelete,
      isSendNotification: isSendNotification,
    };
    return im.ChatRoom.get({
      id: chatRoomId
    }).setEntry(entry);
  }

  function setChatRoomEntries(chatRoomId, entries, isAutoDelete, extra) {
    try {
      entries = JSON.parse(entries);
    } catch(e) {
      alert('自定义kv属性集合输入错误');
      throw e;
    }
    const options = {
      entries,
      notificationExtra: extra,
      isAutoDelete,
    };
    return im.ChatRoom.get({
      id: chatRoomId
    }).setEntries(options);
  }

  function forceSetChatRoomEntry(key, value, isAutoDelete, isSendNotification, extra, chatRoomId) {
    var entry = {
      key: key,
      value: value,
      notificationExtra: extra,
      isAutoDelete: isAutoDelete,
      isSendNotification: isSendNotification
    };
    return im.ChatRoom.get({
      id: chatRoomId
    }).forceSetEntry(entry);
  }

  function removeChatRoomEntry(key, isSendNotification, extra, chatRoomId) {
    var entry = {
      key: key,
      notificationExtra: extra,
      isSendNotification: isSendNotification
    };
    return im.ChatRoom.get({
      id: chatRoomId
    }).removeEntry(entry);
  }

  function removeChatRoomEntries(chatRoomId, entries, extra) {
    try {
      entries = JSON.parse(entries);
    } catch(e) {
      alert('自定义kv属性集合输入错误');
      throw e;
    }
    return im.ChatRoom.get({
      id: chatRoomId
    }).removeEntries({
      entries,
      notificationExtra: extra
    });
  }
  

  function forceRemoveChatRoomEntry(key, isSendNotification, extra, chatRoomId) {
    var entry = {
      key: key,
      notificationExtra: extra,
      isSendNotification: isSendNotification
    };
    return im.ChatRoom.get({
      id: chatRoomId
    }).forceRemoveEntry(entry);
  }

  function getChatRoomEntry(key, chatRoomId) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).getEntry(key);
  }

  function getAllChatRoomEntries(chatRoomId) {
    return im.ChatRoom.get({
      id: chatRoomId
    }).getAllEntries();
  }

  function joinRTCRoom(roomId, mode) {
    return im.RTC.get({
      roomId: roomId,
      mode: mode
    }).join();
  }

  function pingRTCRoom(roomId, mode) {
    return im.RTC.get({
      roomId: roomId
    }).ping();
  }

  function setRTCData(roomId, key, value, isInner, apiType, message) {
    return im.RTC.get({
      roomId: roomId
    }).setData(key, value, isInner, apiType, message);
  }

  function getRTCData(roomId, key, isInner, apiType) {
    return im.RTC.get({
      roomId: roomId
    }).getData([key], isInner, apiType);
  }

  function removeRTCData(roomId, key, isInner, apiType) {
    return im.RTC.get({
      roomId: roomId
    }).removeData([key], isInner, apiType);
  }

  function getRTCToken(roomId) {
    return im.RTC.get({
      roomId: roomId
    }).getToken();
  }

  function getRTCRoomInfo(roomId) {
    return im.RTC.get({
      roomId: roomId
    }).getRoomInfo();
  }

  function getRTCUserInfoList(roomId) {
    return im.RTC.get({
      roomId: roomId
    }).getUserInfoList();
  }

  function setRTCUserInfo(roomId) {
    return im.RTC.get({
      roomId: roomId
    }).setUserInfo({
      key: 'test',
      value: 'test hahahah'
    });
  }

  function removeRTCUserInfo(roomId) {
    return im.RTC.get({
      roomId: roomId
    }).removeUserInfo({
      key: 'test'
    });
  }

  function quitRTCRoom(roomId, mode) {
    return im.RTC.get({
      roomId: roomId,
      mode: mode
    }).quit();
  }

  function setConversationStatus(isNotification, isTop, conversationType, targetId) {
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).setStatus({
      notificationStatus: isNotification,
      isTop: isTop
    });
  }

  function getConversationStatus(conversationType, targetId, channelId) {
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).getStatus(
      conversationType,
      targetId,
      channelId
    );
  }

  function setMessageKV(){
    console.log('setMessageKV');
    return Promise.resolve('set message kv')
  }

  function updateMessageExpansion(conversationType, targetId, messageUId, key, value, canIncludeExpansion, isTest) {
    
    key && (key = key.split(','));
    value && (value = value.split(','));
    var expansion = {};
    key.forEach((item,idx) => {
      expansion[item] = value[idx];
    })

    let message;
    if (isTest) {
      message = {
        canIncludeExpansion,
        messageUId,
        type: conversationType,
        targetId
      }
    }else {
      message = CacheMsg.getLast();
      if(utils.isEmpty(message)) {
        return utils.Defer.reject('请先发送一条消息')
      }
    }
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).updateMessageExpansion(expansion, message);
  }

  function removeMessageExpansion(conversationType, targetId, keys, messageUId, canIncludeExpansion, isTest) {
    keys.length > 0 && (keys = keys.split(','));
    let message;
    if (isTest) {
      message = {
        canIncludeExpansion: canIncludeExpansion == undefined ? true : canIncludeExpansion,
        messageUId,
        type: conversationType,
        targetId
      }
    }else {
      message = CacheMsg.getLast();
      if(utils.isEmpty(message)) {
        return utils.Defer.reject('请先发送一条消息')
      }
    }
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).removeMessageExpansion(keys, message);
  }

  function removeMessageAllExpansion(conversationType, targetId, messageUId) {
    return im.Conversation.get({
      type: conversationType,
      targetId: targetId
    }).removeMessageAllExpansion(messageUId);
  }
 

  function getLastCacheMsgUId() {
    return CacheMsg.getLast().messageUId;
  }
  function getLastCacheMsgSentTime() {
    return CacheMsg.getLast().sentTime;
  }
  function getLastCacheMsgDirection() {
    return CacheMsg.getLast().direction;
  }
  /**
   * 创建标签
   * @param {string} tagId 标签ID
   * @param {string} tagName 标签名称
   */
  function createTag(tagId,tagName) {
    return im.Tag.create({tagId,tagName}).then(data=>data)
  }
  /**
   * 修改标签
   * @param {string} tagId 标签ID
   * @param {string} tagName 标签名称
   */
  function updateTag(tagId,tagName) {
    return im.Tag.get(tagId).then(tag=>{
      return tag.update(tagName).then(data=>data)
    })
  }
  /**
   * 获取标签列表
   */
  function getTagInfoList() {
    return im.Tag.getTagInfoList().then(data=>data)
  }

  /**
   * 删除标签
   */
  function removeTag(tagId) {
    return im.Tag.get(tagId).then(tag=>{
      return tag.remove().then(data=>data)
    })
  }
  /**
   * 添加会话到指定标签
   */
  function addConversations(tagId, targetId, type, channelId, multiConversation) {
    var conList = multiConversation.trim() ? JSON.parse(multiConversation) : [{
      targetId,
      type,
      channelId
    }];

    return im.Tag.get(tagId).then(tag=>{
      return tag.addConversations(conList).then(data=>data)
    })
  }

  /**
   * 从多个会话中批量删除指定标签
   */
  function removeConversations(tagId, targetId, type, channelId, multiConversation) {
    var conList = multiConversation.trim() ? JSON.parse(multiConversation) : [{
      targetId,
      type,
      channelId
    }];

    return im.Tag.get(tagId).then(tag=>{
      return tag.removeConversations(conList).then(data=>data)
    })
  }

  /**
   * 分页获取标签下会话列表
   */
  function getConversationListFromTag(tagId, count, startTime) {
    return im.Tag.get(tagId).then(tag=>{
      return tag.getConversationList(startTime,count).then(data=> data)
    })
  }

  /**
   * 根据标签获取未读消息数
   */
  function getUnreadCountFromTag(tagId, containMuted) {
    return im.Tag.get(tagId).then(tag=>{
      return tag.getUnreadCount(containMuted).then(data=>{
        return data
      })
    })
  }

  /**
   * 设置标签中会话置顶
   */
  function updateConversationIsTop(tagId, targetId, type, channelId, isTop) {
    var con = {
      targetId,
      type,
      channelId
    };
    return im.Tag.get(tagId).then(tag=>{
      tag.updateConversationIsTop(con,isTop).then(data=>data)
    })
  }

  /**
   * 从单一会话中批量删除标签
   */
  function removeTags(tagId, targetId, type) {
    var _tagId = tagId.split(',')
    return im.Conversation.get({type,targetId}).removeTags(_tagId).then(data=>data)
  }
  /**
   * 获取会话下的标签
   */
  function getTags(targetId, type) {
    return im.Conversation.get({type,targetId}).getTags().then(data=> data)
  }
  win.RongIM = win.RongIM || {};
  win.RongIM.Service = {
    init: init,
    disconnect: disconnect,
    reconnect: reconnect,
    getConnectedTime: getConnectedTime,

    registerMessage: registerMessage,
    sendRegisterMessage: sendRegisterMessage,

    getConversationList: getConversationList,
    removeConversation: removeConversation,

    getHistoryMessages: getHistoryMessages,
    clearHistoryMessages: clearHistoryMessages,
    deleteRemoteMessages: deleteRemoteMessages,

    sendTextMessage: sendTextMessage,
    sendImageMessage: sendImageMessage,
    sendFileMessage: sendFileMessage,
    sendVoiceMessage: sendVoiceMessage,
    sendAtMessage: sendAtMessage,
    sendAtMessageByErrorParamField: sendAtMessageByErrorParamField,
    sendLocationMessage: sendLocationMessage,
    sendRichContentMessage: sendRichContentMessage,
    sendRecallMessage: sendRecallMessage,
    sendReferenceMessage: sendReferenceMessage,
    sendSightMessage: sendSightMessage,
    sendReadReceiptRequestMessage: sendReadReceiptRequestMessage,
    sendReadReceiptResponseMessage: sendReadReceiptResponseMessage,
    sendNewReadReceiptResponseMessage: sendNewReadReceiptResponseMessage,
    getMessageReader: getMessageReader,
    sendTypingMessage: sendTypingMessage,
    
    getUnreadCount: getUnreadCount,
    getTotalUnreadCount: getTotalUnreadCount,
    clearUnreadCount: clearUnreadCount,
    setDraft: setDraft,
    getDraft: getDraft,
    deleteDraft: deleteDraft,

    joinChatRoom: joinChatRoom,
    joinExistChatRoom: joinExistChatRoom,
    quitChatRoom: quitChatRoom,
    getChatRoomInfo: getChatRoomInfo,
    getChatRoomHistoryMessages: getChatRoomHistoryMessages,
    sendChatRoomMessage: sendChatRoomMessage,
    recallChatroomMessage: recallChatroomMessage,
    setChatRoomEntry: setChatRoomEntry,
    setChatRoomEntries: setChatRoomEntries,
    forceSetChatRoomEntry: forceSetChatRoomEntry,
    removeChatRoomEntry: removeChatRoomEntry,
    forceRemoveChatRoomEntry: forceRemoveChatRoomEntry,
    removeChatRoomEntries: removeChatRoomEntries,
    getChatRoomEntry: getChatRoomEntry,
    getAllChatRoomEntries: getAllChatRoomEntries,

    getLastCacheMsgSentTime: getLastCacheMsgSentTime,
    getLastCacheMsgUId: getLastCacheMsgUId,
    getLastCacheMsgDirection: getLastCacheMsgDirection,
    msgEmitter: CacheMsg.eventEmitter,

    changeUser: changeUser,

    joinRTCRoom: joinRTCRoom,
    quitRTCRoom: quitRTCRoom,
    pingRTCRoom: pingRTCRoom,
    setRTCData: setRTCData,
    getRTCData: getRTCData,
    removeRTCData: removeRTCData,
    getRTCToken: getRTCToken,
    getRTCRoomInfo: getRTCRoomInfo,
    getRTCUserInfoList: getRTCUserInfoList,
    setRTCUserInfo: setRTCUserInfo,
    removeRTCUserInfo: removeRTCUserInfo,
    setConversationStatus: setConversationStatus,
    getConversationStatus: getConversationStatus,
    setMessageKV,
    updateMessageExpansion,
    removeMessageExpansion,
    removeMessageAllExpansion,
    im,
    createTag,
    updateTag,
    getTagInfoList,
    removeTag,
    addConversations,
    removeConversations,
    getConversationListFromTag,
    getUnreadCountFromTag,
    updateConversationIsTop,
    removeTags,
    getTags
  };
  
})(window);