var restify = require('restify');
var stringify = require('stringify');
var config = require('config');
var dbHandler = require('./DBBackendHandler.js');
var redisHandler = require('./RedisHandler.js');
var messageFormatter = require('DVP-Common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var hostIp = config.Host.Ip;
var hostPort = config.Host.Port;
var hostVersion = config.Host.Version;

var server = restify.createServer({
    name: 'localhost',
    version: '1.0.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

var AddToChannelArray = function(chanTags, chanList, callback)
{
    try
    {
        var len = chanTags.length;
        var count = 0;

        chanTags.forEach(function(tag)
        {
            redisHandler.GetFromHash(tag, function(err, hashObj)
            {
                if(count < len)
                {
                    var channelData =
                    {
                        ChannelState: hashObj["Channel-State"],
                        FreeSwitchName: hashObj["FreeSWITCH-Switchname"],
                        ChannelName: hashObj["Channel-Name"],
                        CallDirection: hashObj["Call-Direction"],
                        CallerDestinationNumber : hashObj["Caller-Destination-Number"],
                        OtherLegUuid : hashObj["Other-Leg-Unique-ID"],
                        CallType : hashObj["Call-Type"]
                    };

                    chanList.push(channelData);

                    count++;

                    if(count >= len)
                    {
                        callback(err, chanList);
                    }
                }
                else
                {
                    callback(err, chanList);
                }
            })

        });
    }
    catch(ex)
    {
        callback(ex, userList);
    }
};

var AddToArray = function(userTags, userList, callback)
{
    try
    {
        var len = userTags.length;
        var count = 0;

        userTags.forEach(function(tag)
        {
                redisHandler.GetFromHash(tag, function(err, hashObj)
                {
                    if(count < len)
                    {
                        var user = {
                            SipUsername: hashObj.username,
                            RegistrationStatus: hashObj.RegisterState
                        };

                        userList.push(user);

                        count++;

                        if(count >= len)
                        {
                            callback(err, userList);
                        }
                    }
                    else
                    {
                        callback(err, userList);
                    }
                })

        });
    }
    catch(ex)
    {
        callback(ex, userList);
    }
};

var AddToInstanceInfoArray = function(callServerList, callback)
{
    var instanceInfoList = [];
    try
    {
        var len = callServerList.length;
        var count = 0;

        callServerList.forEach(function(cs)
        {
            var csId = cs.id;
            redisHandler.GetObject(csId + '#DVP_CS_INSTANCE_INFO', function(err, instanceInfo)
            {
                if(count < len)
                {
                    if(instanceInfo)
                    {
                        var instanceInfoObj = JSON.parse(instanceInfo);

                        instanceInfoList.push(instanceInfoObj);
                    }

                    count++;

                    if(count >= len)
                    {
                        callback(err, instanceInfoList);
                    }

                }
                else
                {
                    callback(err, instanceInfoList);
                }
            })

        });
    }
    catch(ex)
    {
        callback(ex, instanceInfoList);
    }
};

var AddToConferenceDetailArray = function(confNameTags, confDetailList, callback)
{
    try
    {
        var len = confNameTags.length;
        var count = 0;

        if(count < len)
        {
            confNameTags.forEach(function(tag)
            {
                redisHandler.GetObject('ConferenceNameMap_' + tag, function(err, confId)
                {
                    if(count < len)
                    {
                        if (!err && confId)
                        {
                            redisHandler.GetFromHash(confId, function(err, hashObj)
                            {
                                if(!err && hashObj)
                                {
                                    var conferenceData =
                                    {
                                        ConferenceId: confId,
                                        ConferenceName: tag,
                                        Data: JSON.parse(hashObj['Data'])
                                    };

                                    confDetailList.push(conferenceData);

                                    count++;

                                    if (count >= len) {
                                        callback(err, confDetailList);
                                    }
                                }
                                else
                                {
                                    count++;

                                    if (count >= len) {
                                        callback(err, confDetailList);
                                    }
                                }
                            })

                        }
                        else
                        {
                            count++;

                            if (count >= len) {
                                callback(err, confDetailList);
                            }
                        }
                    }
                    else
                    {
                        callback(err, confDetailList);
                    }
                })

            });
        }
        else
        {
            callback(undefined, confDetailList);
        }

    }
    catch(ex)
    {
        callback(ex, confDetailList);
    }
};

var AddToConferenceUserArray = function(confId, confUserTags, confUserList, callback)
{
    try
    {
        var len = confUserTags.length;
        var count = 0;

        if(count < len)
        {
            confUserTags.forEach(function(tag)
            {
                var userHash = "Conference-User-" + confId + "-" + tag;

                if (count < len)
                {
                    redisHandler.GetFromHash(userHash, function (err, hashObj)
                    {
                        if (!err && hashObj)
                        {
                            var userData =
                            {
                                Username: hashObj['Caller-Username'],
                                UserType: hashObj['Member-Type'],
                                UserState: hashObj['Member-State']
                            };

                            confUserList.push(userData);

                            count++;

                            if (count >= len)
                            {
                                callback(err, confUserList);
                            }
                        }
                        else
                        {
                            count++;

                            if (count >= len)
                            {
                                callback(err, confUserList);
                            }
                        }
                    })

                }
                else
                {
                    callback(undefined, confUserList);
                }


            });
        }
        else
        {
            callback(undefined, confUserList);
        }

    }
    catch(ex)
    {
        callback(ex, confUserList);
    }
};

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetSipRegDetailsByCompany/:companyId/:tenantId', function(req, res, next)
{
    try
    {
        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        var userList = [];

        dbHandler.GetDomainByCompany(companyId, tenantId, function (err, endUser)
        {
            if(endUser && endUser.Domain)
            {
                //Get Registration Details From Redis
                redisHandler.GetFromSet('SIPREG@' + endUser.Domain, function(err, userTags)
                {
                    if(userTags && userTags.length > 0)
                    {
                        //get all user hash sets from redis
                        AddToArray(userTags, userList, function(err, arrRes)
                        {
                            if(err)
                            {
                                var jsonStr = JSON.stringify(userList);
                                res.end(jsonStr);
                            }
                            else
                            {
                                var jsonStr = JSON.stringify(arrRes);
                                res.end(jsonStr);
                            }

                        })
                    }
                    else
                    {
                        var jsonString = JSON.stringify(userList);
                        res.end(jsonString);
                    }
                });

            }
            else
            {
                var jsonString = JSON.stringify(userList);

                res.end(jsonString);
            }
        });

        return next();
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetSipRegDetailsByUser/:user/:companyId/:tenantId', function(req, res, next)
{
    try
    {
        var user = req.params.user;
        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        dbHandler.GetDomainByCompany(companyId, tenantId, function (err, endUser)
        {
            if (endUser && endUser.Domain)
            {
                //Get Registration Details From Redis
                var tag = 'SIPUSER:' + user + "@" + endUser.Domain;

                redisHandler.GetFromHash(tag, function (err, hashObj)
                {
                    if(err)
                    {
                        res.end('{}');
                    }
                    else
                    {
                        var sipUser = {
                            SipUsername: hashObj.username,
                            RegistrationStatus: hashObj.RegisterState,
                            ExtraData: JSON.parse(hashObj.Data)

                        };

                        var jsonString = JSON.stringify(sipUser);

                        res.end(jsonString);
                    }


                });


            }
            else
            {
                res.end('{}');
            }
        });


        return next();
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetCallsCount/:instanceId', function(req, res, next)
{
    try
    {
        var instanceId = req.params.instanceId;

        var callCountKey = instanceId + '#DVP_CALL_COUNT';

        redisHandler.GetObject(callCountKey, function (err, callCount)
        {
            if (err)
            {
                res.end('{}');
            }
            else
            {
                res.end(callCount);
            }


        });
    }
    catch(ex)
    {
        res.end('{}');
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetInstanceResourceUtilization/:instanceId', function(req, res, next)
{
    try
    {
        var instanceId = req.params.instanceId;

        var instanceInfoKey = instanceId + '##DVP_CS_INSTANCE_INFO';

        redisHandler.GetObject(instanceInfoKey, function (err, instanceInf)
        {
            if (err)
            {
                res.end('{}');
            }
            else
            {
                res.end(JSON.stringify(instanceInf));
            }

        });
    }
    catch(ex)
    {
        res.end('{}');
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetClusterResourceUtilization/:clusterId', function(req, res, next)
{
    try
    {
        var clusterId = req.params.clusterId;

        var emptyArr = [];

        dbHandler.GetCallServersForCluster(clusterId, function(err, result)
        {
            if(err || !result)
            {
                var jsonStr = JSON.stringify(emptyArr);

                res.end(jsonStr);
            }
            else
            {
                if(result.CallServer && result.CallServer.length > 0)
                {
                    AddToInstanceInfoArray(result.CallServer, function(err, infoList)
                    {
                        var jsonStr = JSON.stringify(infoList);

                        res.end(jsonStr);
                    })
                }
                else
                {
                    var jsonStr = JSON.stringify(emptyArr);

                    res.end(jsonStr);
                }
            }
        });

        var instanceInfoKey = instanceId + '##DVP_CS_INSTANCE_INFO';

        redisHandler.GetObject(instanceInfoKey, function (err, instanceInf)
        {
            if (err)
            {
                res.end('{}');
            }
            else
            {
                res.end(JSON.stringify(instanceInf));
            }

        });
    }
    catch(ex)
    {
        res.end('{}');
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetChannelCount/:instanceId', function(req, res, next)
{
    try
    {
        var instanceId = req.params.instanceId;

        var channelCountKey = instanceId + '#DVP_CHANNEL_COUNT';

        redisHandler.GetObject(channelCountKey, function (err, chanCount)
        {
            if (err)
            {
                res.end('{}');
            }
            else
            {
                res.end(chanCount);
            }

        });
    }
    catch(ex)
    {
        res.end('{}');
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetChannelById/:channelId', function(req, res, next)
{
    try
    {
        var channelId = req.params.channelId;


        //Get Registration Details From Redis

        redisHandler.GetFromHash(channelId, function (err, hashObj)
        {
            if (err)
            {
                res.end('{}');
            }
            else
            {
                var channelData =
                {
                    ChannelState: hashObj["Channel-State"],
                    FreeSwitchName: hashObj["FreeSWITCH-Switchname"],
                    ChannelName: hashObj["Channel-Name"],
                    CallDirection: hashObj["Call-Direction"],
                    CallerDestinationNumber : hashObj["Caller-Destination-Number"],
                    OtherLegUuid : hashObj["Other-Leg-Unique-ID"],
                    CallType : hashObj["Call-Type"]
                };

                var jsonString = JSON.stringify(channelData);

                res.end(jsonString);
            }


        });
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetChannelsByCompany/:companyId/:tenantId', function(req, res, next)
{
    try
    {
        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        var chanList = [];

        dbHandler.GetDomainByCompany(companyId, tenantId, function (err, endUser)
        {
            if(endUser && endUser.Domain)
            {
                //Get Registration Details From Redis
                redisHandler.GetFromSet('CHANNEL@' + endUser.Domain, function(err, chanTags)
                {
                    if(chanTags && chanTags.length > 0)
                    {
                        //get all user hash sets from redis
                        AddToChannelArray(chanTags, chanList, function(err, arrRes)
                        {
                            if(err)
                            {
                                var jsonStr = JSON.stringify(chanList);
                                res.end(jsonStr);
                            }
                            else
                            {
                                var jsonStr = JSON.stringify(chanList);
                                res.end(jsonStr);
                            }

                        })
                    }
                    else
                    {
                        var jsonString = JSON.stringify(chanList);
                        res.end(jsonString);
                    }
                });

            }
            else
            {
                var jsonString = JSON.stringify(chanList);

                res.end(jsonString);
            }
        });

        return next();
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetConferenceRoomsByCompany/:companyId/:tenantId', function(req, res, next)
{
    try
    {
        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        dbHandler.GetConferenceListByCompany(companyId, tenantId, function (err, confList)
        {
            if(err)
            {
                res.end('{}');
            }
            else
            {
                if (confList && confList.length > 0)
                {
                    //Get Registration Details From Redis
                    var tagList = [];
                    var confDetailList = [];

                    confList.forEach(function(conf)
                    {
                        var tag = conf.ConferenceName;
                        tagList.push(tag);
                    });

                    AddToConferenceDetailArray(tagList, confDetailList, function(err, confList)
                    {
                        if(err)
                        {
                            res.end('{}');
                        }
                        else
                        {
                            var jsonString = JSON.stringify(confList);

                            res.end(jsonString);
                        }
                    })

                }
                else
                {
                    res.end('{}');
                }
            }

        });


        return next();
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.get('/DVP/API/' + hostVersion + '/MonitorRestAPI/GetConferenceUsers/:roomName/:companyId/:tenantId', function(req, res, next)
{
    try
    {
        var roomName = req.params.roomName;
        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        var confUserList = [];

        dbHandler.GetConferenceRoomWithCompany(roomName, companyId, tenantId, function (err, conf)
        {
            if(err)
            {
                var jsonString = JSON.stringify(confUserList);
                res.end(jsonString);
            }
            else
            {
                if (conf)
                {
                    //Get Registration Details From Redis
                    redisHandler.GetObject('ConferenceNameMap_' + roomName, function(err, confId)
                    {
                       if(!err && confId)
                       {
                           redisHandler.GetFromSet('Conference-Member-List-' + confId, function(err, usersArr)
                           {
                               if(!err && usersArr && usersArr.length > 0)
                               {

                                   AddToConferenceUserArray(confId, usersArr, confUserList, function(err, usrList)
                                   {
                                       if(!err && usrList)
                                       {
                                           var jsonString = JSON.stringify(usrList);
                                           res.end(jsonString);
                                       }
                                       else
                                       {
                                           var jsonString = JSON.stringify(confUserList);
                                           res.end(jsonString);
                                       }
                                   })


                               }
                               else
                               {
                                   var jsonString = JSON.stringify(confUserList);
                                   res.end(jsonString);
                               }

                           })
                       }
                       else
                       {
                           var jsonString = JSON.stringify(confUserList);
                           res.end(jsonString);
                       }
                    });

                }
                else
                {
                    var jsonString = JSON.stringify(confUserList);
                    res.end(jsonString);
                }
            }

        });

        return next();
    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, undefined);
        res.end(jsonString);
    }

    return next();

});

server.listen(hostPort, hostIp, function () {
    console.log('%s listening at %s', server.name, server.url);
});