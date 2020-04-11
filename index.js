const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const bodyParser = require('body-parser');
const sessions = require('client-sessions');
const Post = require('./model/post');
const User = require('./model/user');
const Group = require('./model/group');
const Contribution = require('./model/contribution');

var groupSearch=[];
var userSearch=[];
mongoose.connect(process.env.MONGODB,{
    useNewUrlParser:true,
    useCreateIndex:true
});

const app = express();
const server = http.createServer(app);
const io = socketio(server);
var wishList = ['http://127.0.0.1:3000','http://localhost:3000','https://anikettyagi-grouphub.herokuapp.com']
app.use(cors({
    origin:function(origin,callback){
        if(wishList.indexOf(origin)!==-1){
            callback(null,true)
        }else{
            callback(new Error('not allowed by cors'))
        }
    },
    credentials:true
}));
// app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );
app.use(sessions({
    cookieName:'users',
    secret:process.env.SECRET,
    duration: 24*60*60*60*1000
}));

const auth= async(req,res,next)=>{
    try{
        groupSearch=await Group.find({});
        userSearch=await User.find({}); 
        console.log(req.users.user);
        const user = await User.findOne({email:req.users.user.email,password:req.users.user.password});
        if(!user){
            throw new Error("No User Found");
        }else{
            next();
        }
    }catch(e){
        console.log(e);
        res.status(200).send({loggedIn:'false'});
    }

}
app.get('/api/logout',auth,async(req,res)=>{
    try{
        req.users =null;
        res.status(200).send({done:"ok"});
    }catch(e){
        res.status(400).send(e);
    }
})
app.post('/api/create_user',async (req,res)=>{
    try{
        const user = new User({
            username:req.body.username,
            email:req.body.email,
            password:req.body.password,
            contributions:0
        });
        userSearch.push(user);
        await user.save();
        console.log(user);
        delete user.contributions;
        delete user.followers;
        delete user.following;
        delete user.groups;
        req.users.user = user;
        res.status(200).send();
    }catch(e){
        res.status(404).send(e);
    }
});

app.post("/api/login",async (req,res)=>{
    try{
        res.setHeader('Set-Cookie', "SameSite=None;Secure");
        const user = await User.findOne({email:req.body.email,password:req.body.password});
        if(!user){
            throw new Error("User Not Found");
        }else{
            delete user.contributions;
            delete user.followers;
            delete user.following;
            delete user.groups;
            req.users.user = user;
            res.status(200).send(req.user);
        }
    }catch(e){
        res.status(401).send(e)
    }
})

app.get('/api/post',auth,async(req,res)=>{
    const user =await User.findById(req.users.user._id);
    var groupnames=[];
    for(var i=0;i<user.groups.length;i++){
        const group =await Group.findById(user.groups[i].group);
        groupnames.push(group.groupname);
    }
    console.log(groupnames)
    res.status(200).send({username:req.users.user.username,groupnames});
})
app.post('/api/post',auth,async (req,res)=>{
    try{
        const post = new Post({
        post:req.body.post,
        owner: req.users.user._id,
        applause:0,
    });
    await post.save();
    res.status(200).send()
    }catch(e){
         console.log(e);
        res.status(404).send()
    }
});

app.post('/api/group/:groupname',auth,async(req,res)=>{
    try{
        const group = await Group.findOne({groupname:req.params.groupname})
        const user = await User.findById(req.users.user._id);
        const leader = await User.findById(group.leader);
        var k=0
        console.log(user.groups.length);
        for(var i=0;i<group.members.length;i++){
            var id= group.members[i].member
            if(group.members[i].member==req.users.user._id){
                k=1;
            }
        }
        if(k==1){
        await group.populate({
            path:'contributions',
            options:{
                    limit:parseInt(req.body.limit),
                    sort:{
                        timestamp:-1
                    }
            }
        }).execPopulate();
        var data = {
            group:group,
            leader:leader.username,
        }
        var contributions=[];
        for(var i=0;i<group.contributions.length;i++){
            var u = await User.findById(group.contributions[i].owner)
            contributions[i]={
                contribution:group.contributions[i].post,
                _id:group.contributions[i]._id,
                owner:u.username,
                applause:group.contributions[i].applause,
                applaused:'applause'
            }
            for(var j=0;j<group.contributions[i].applausedBy.length;j++){
                if(group.contributions[i].applausedBy[j].applause.toString()==req.users.user._id.toString()){
                    contributions[i].applaused='applaused'
                    j=group.contributions[i].applausedBy.length;
                }
            }
        }
        data.contributions=contributions;
        t=0;
        console.log(group.leader,req.users.user._id);
        if(group.leader==req.users.user._id){
            t=1;
            data.noOfNotification=group.notifications.length.toString();
            data.requests= group.requests.length.toString();
        }
        if(t!=1){
            for(var i=0;i<3;i++){
                if(req.users.user._id==group.councilOfLeaders[i].leader){
                    data.noOfNotification=group.notifications.length.toString()
                    data.requests = group.requests.length.toString();
                    console.log(data.noOfNotification);
                    break;
                }
            }
        }
        var groupnames=[];
        for(var i=0;i<user.groups.length;i++){
            var group1 = await Group.findById(user.groups[i].group);
            groupnames.push(group1.groupname);
        }
        res.status(200).send({member:true,data,username:req.users.user.username,groupnames});
    }else{
        var data={
            group:group,
            leader:leader.username
        }
        if(user.requested){
        for(var i=0;i<user.requested.length;i++){
            if(group._id.toString()==user.requested[i].request.toString()){
                data.requested='requested'
            }
        }
    }
    var groupnames=[];
    for(var i=0;i<user.groups.length;i++){
        var group1 = await Group.findById(user.groups[i].group);
        groupnames.push(group1.groupname);
    }
        res.status(200).send({member:false,data,groupnames})
    }
    }catch(e){
        console.log(e);    
        res.status(400).send();
    }
});

app.get('/api/group/:groupname/:contribution/:comment/increase',auth,async(req,res)=>{
    const group = await Group.findOne({groupname:req.params.groupname});
    const contribution = await Contribution.findById(req.params.contribution);
    const user = await User.findById(req.users.user._id);
    var k=0;
    for(var i=0;i<user.groups.length;i++){
        if(user.groups[i].group.toString()==group._id.toString()){
            k=1;
            if(!user.groups[i].applaused){
                user.groups[i].applaused=0;
            }
            console.log("okokojojosijskdnaksl;nf;jasd");
            user.groups[i].applaused+=1;
            break;
        }
    }
    if(k==1){
        for(var i=0;i<contribution.comments.length;i++){
            if(contribution.comments[i]._id.toString()==req.params.comment.toString()){
                contribution.comments[i].applause+=1;
                contribution.comments[i].applausedBy.push({
                    applause:req.users.user._id
                })
                await user.save();
                await contribution.save()
                break;
            }
        }
        res.status(200).send({ok:true})
    }else{
        res.status(403).send({ok:false});
    }
})

app.get('/api/group/:groupname/:contribution/comments',auth,async(req,res)=>{
    try{const group = await Group.findOne({groupname:req.params.groupname});
    var k=0;
    for(var i=0;i<group.members.length;i++){
        if(group.members[i].member.toString()==req.users.user._id.toString()){
            k=1;
            break;
        }
    }
    if(k==1){
        const contribution = await Contribution.findById(req.params.contribution);
        console.log(contribution.owner);
        comments=[];
        var k=-1;
        for(var i of contribution.comments){
            var user = await User.findById(i.writer)
            comments.push({
                _id:i._id,
                comment:i.comment,
                writer:user.username,
                applause:i.applause,
                applaused:'applause'
            })
            k++;
            for(j=0;j<i.applausedBy.length;j++){    
            console.log("okay",i.applausedBy[j].applause);
                if(i.applausedBy[j].applause.toString()==req.users.user._id.toString()){
                    comments[k].applaused='applaused';
                    j=i.applausedBy.length;
                }
            }
        }
        var user = await User.findById(contribution.owner);
        console.log(user,contribution.owner);
        var v = {
            owner:user.username,
            contribution:contribution.post,
            comments:comments
        }
        var groupnames=[];
        user = await User.findById(req.users.user._id);
        for(var i=0;i<user.groups.length;i++){
            const group = await Group.findById(user.groups[i].group);
            groupnames.push(group.groupname)
        }
        v.groupnames=groupnames;
        res.status(200).send(v);
    }else{
        throw new Error('Not permitted');
    }
}catch(e){
    console.log(e);
    res.status(403).send();
} 
})
app.post('/api/group/:groupname/:contribution/comments',auth,async(req,res)=>{
    const group = await Group.findOne({groupname:req.params.groupname});
    const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    var k=0;
    for(var i=0;i<group.members.length;i++){
        console.log(group.members[i].member,req.users.user._id)
        if(group.members[i].member.toString()==req.users.user._id.toString()){
            k=1;
            break;
        }
    }if(k==1){
        const contribution = await Contribution.findById(req.params.contribution);
        // console.log(contribution)
        contribution.comments.push({
            comment:req.body.comment,
            writer:req.users.user._id,
            applause:0,
        });
        for(var i=0;i<user.groups.length;i++){
            if(user.groups[i].group.toString()==group._id.toString()){
                if(!user.groups[i].commented){
                    user.groups[i].commented=0;
                }
                user.groups[i].commented+=1;
            }
        }
        await user.save();
        await contribution.save();
        res.status(200).send()
    }else{
        console.log("noooooo")
        res.status(403).send()
    }
})


app.get('/api/group/:groupname/:contribution/increase',auth,async(req,res)=>{
    var user = await User.findOne({username:req.users.user.username,_id:req.users.user._id})
    var contribution = await Contribution.findById(req.params.contribution);
    var group = await Group.findOne({groupname:req.params.groupname});
    var k=0;
    for(var i=0;i<group.members.length;i++){
        if(group.members[i].member.toString()==req.users.user._id.toString()){
            k=1;
        }
    }
    if(k==1){
        contribution.applause+=1;
        contribution.applausedBy.push({
            applause:req.users.user._id
        });
        for(var i=0;i<user.groups.length;i++){
            if(!user.groups[i].applaused){
                user.groups[i].applaused=0;
            }
            console.log(user.groups[i].group.toString()==group._id.toString())
            if(user.groups[i].group.toString()==group._id.toString()){
            console.log("okooko",user.groups[i].group.toString(),group._id.toString())
            user.groups[i].applaused+=1;
            }
        }
        await user.save();
        await contribution.save();
        res.status(200).send({ok:true});
    }
    else{
        res.status(403).send({ok:true});
    }
})

app.post('/api/:groupname/:notification/request',auth,async(req,res)=>{
    try{
        var k=0;
        var groupid=0;
        var group = await Group.findOne({groupname:req.params.groupname});
        if(group.leader == req.users.user._id){
            k=1;
        }
        if(k!=1){
            for(var i=0;i<3;i++){
                if(group.councilOfLeaders[i].leader==req.users.user._id){
                    k=1;
                    break;
                }
            }
        }
        if(k==1){
        if(req.body.choice=="accept"){
            for(var i=0;i<group.notifications.length;i++){
                if(group.notifications[i]._id == req.params.notification){
                    const user =await User.findOne({_id:group.notifications[i].contributor});
                    const noti = new Contribution({
                        owner:group.notifications[i].contributor,
                        post:group.notifications[i].notification,
                        applause:0,
                        group:group._id
                    });
                    await noti.save();
                    group.noOfContributions+=1;
                    group.notifications.splice(i,1);
                    await group.save();
                    for(var i=0;i<user.groups.length;i++){
                        console.log("yoyoyooyoyoyooyoyooyooyyoyo");
                        console.log(user.groups[i].group,group._id)
                        if(user.groups[i].group.toString()==group._id.toString()){
                            console.log(user.groups[i])
                            user.groups[i].contribution+=1;
                            user.contributions+=1;
                            groupid=i;
                            if(user.groups[i].contribution==10){
                                group.contributors.push({
                                    contributor:user._id
                                })
                                await group.save();
                            }
                            await user.save();
                            var t=1;
                            var min=0;
                            if(user.groups[i].contribution>=10){
                                min=group.councilOfLeaders[0].contributions;
                                for(var j=1;j<3;j++){
                                    if(min>group.councilOfLeaders[j].contributions){
                                            min=group.councilOfLeaders[j].contributions;
                                            t=j;
                                        
                                    }
                                }
                                if(min<user.groups[groupid].contribution){
                                    group.councilOfLeaders.splice(t,1);
                                    // console.log(user.groups[groupid])
                                    group.councilOfLeaders.push({
                                        leader:user._id,
                                        contributions:user.groups[groupid].contribution
                                    })
                                    await group.save();
                                }
                            }
                        }
                    }
                    break;    
                }
            }
            
        }else if(req.body.choice=="reject"){
            for(var i =0;i<group.notifications.length;i++){
                if(group.notifications[i]._id==req.params.notification){
                    group.notifications.splice(i,1);
                    await group.save();
                    break;
                }
            }
        }
        res.status(200).send({ok:true});
    }else{
        console.log("asd");
        throw new Error();
    }
    }catch(e){
        console.log(e);
        res.status(400).send({ok:false})
    }
})

app.get('/api/group/:groupname/memberrequest',auth,async(req,res)=>{
    try{
        const group = await Group.findOne({groupname:req.params.groupname});
        var t=0;
        for(var i =0 ;i<3;i++){
        if(req.users.user._id.toString()==group.councilOfLeaders[i].leader.toString()){
            t=1;
        }
    }
        if(req.users.user._id== group.leader||t==1){
            console.log("too");
            var requests=[];
            for(var i=0 ; i<group.requests.length;i++){
                const user  =await User.findById(group.requests[i].request);
                requests.push({
                    user:user._id,
                    message:`${user.username} has requested to become a member`,
                    _id:group.requests[i]._id
                })
            }
            var noti = {
                requests:requests
            }
            console.log(noti);
            res.status(200).send(noti)
        }else{
            throw new Error('unauthorized') ;
        }
    }catch(e){
        console.log(e);
        res.status(403).send({unauthorized:true})
    }
})

app.post('/api/group/:groupname/:request/memberrequest',auth,async(req,res)=>{
    try{
        var t=1;
        var k=0;
        var group = await Group.findOne({groupname:req.params.groupname});
        var user = await User.findById(req.body._id);
        if(group.leader.toString() == req.users.user._id.toString()){
            k=1;
        }
        if(k!=1){
            for(var i=0;i<3;i++){
                if(group.councilOfLeaders[i].leader.toString()==req.users.user._id.toString()){
                    k=1;
                    break;
                }
            }
        }
        if(k==1){
        if(req.body.choice=="accept"){
            t=1;
            for(var i=0;i<group.requests.length;i++){
                if(group.requests[i]._id == req.params.request){
                    group.members.push({
                        member:user._id
                    })
                    user.groups.push({
                        group:group._id,
                        contribution:0
                    });
                    for(var i=0;i<user.requested.length;i++){
                        console.log(user.requested[i].request)
                        if(user.requested[i].request.toString()==group._id.toString()){
                            user.requested.splice(i,1);
                            break;
                        }
                    }
                    await user.save();
                    group.requests.splice(i,1);
                    await group.save();
                    break;
                }
            }
        }else if(req.body.choice=="reject"){
            t=1;
            for(var i =0;i<group.requests.length;i++){
                if(group.requests[i]._id==req.params.request){
                    group.requests.splice(i,1);
                    await group.save();
                    break;
                }
            }
            for(var i=0;i<user.requested.length;i++){
                if(user.requested[i].request==group._id){
                    user.requested.splice(i,1);
                    await user.save();
                    break;
                }
            }
        }
        if(t==1){
            res.status(200).send({ok:true});
        }
    }else{
        throw new Error();
    }
    }catch(e){
        console.log(e);
        res.status(400).send({ok:false})
    }
})

app.get('/api/group/:groupname/request',auth,async(req,res)=>{
    try{const group = await Group.findOne({groupname:req.params.groupname});
    const user = await User.findOne({username:req.users.user.username});
    group.requests.push({
        request:req.users.user._id
    })
    user.requested.push({
        request:group._id
    })
    await group.save();
    await user.save();
    console.log("wedf");
    res.status(200).send({requested:true})
   }catch(e){
       console.log(e);
       res.status(400).send({requested:false})
   }
})

app.get('/api/:groupname/notification',auth,async(req,res)=>{
    try{
        const group = await Group.findOne({groupname:req.params.groupname});
        var t=0;
        for(var i =0 ;i<3;i++){
            if(req.users.user._id==group.councilOfLeaders[i].leader){
                t=1;
            }
        }
        if(req.users.user._id== group.leader||t==1){
            console.log("too");
            var notification=[];
            for(var i of group.notifications){
                const user  =await User.findById(i.contributor);
                notification.push({
                    contributor:user.username,
                    notification:i.notification,
                    _id:i._id
                })
            }
            var noti = {
                notifications:notification
            }
            console.log(noti);
            res.status(200).send(noti)
        }else{
            throw new Error('unauthorized');
        }
    }catch(e){
        console.log(e);
        res.status(403).send({unauthorized:true})
    }
})

app.post("/api/:groupname/create_contribution",auth,async(req,res)=>{
    var group = await Group.findOne({groupname:req.params.groupname});
    var k=0;
    group.contributors.forEach((contributor)=>{
        if(contributor.contributor == req.users.user._id){
            k=1;
        }
    })
    if(k!=1){
        group.notifications.push({
            notification:req.body.newContribution,
            contributor:req.users.user._id
        })
        await group.save();
        res.status(200).send({requsted:true})
    }else if(k==1){
        const contribution = new Contribution({
            post:req.body.newContribution,
            owner:req.users.user._id,
            group:group._id,
            applause:0
        });
        const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
        var groupid=0;
        for(var i =0;i<user.groups.length;i++){
            if(user.groups[i].group.toString()==group._id.toString()){
                if(!user.groups[i].contribution){
                    user.groups[i].contribution=0;
                }
                user.groups[i].contribution+=1;
                groupid=i;
                break;
            }
        }
        var min=Infinity;
        var t=0;
        for(var i=0;i<3;i++){
            if(user._id.toString()==group.councilOfLeaders[i].leader.toString()){
                group.councilOfLeaders[i].contributions+=1;
            }
            if(min>group.councilOfLeaders[i].contributions){
                min=group.councilOfLeaders[i].contributions;
                t=i;
            }
        }
        if(min<user.groups[groupid].contribution){
            group.councilOfLeaders.splice(t,1);
            group.councilOfLeaders.push({
                leader:user._id,
                contributions:user.groups[groupid].contribution
            })
        }
        group.noOfContributions+=1;
        user.contributions+=1;
        await group.save();
        await user.save();
        await contribution.save();
        res.status(200).send({relode:true}) 
    }
});

app.get('/api/create_group',auth,async (req,res)=>{
    const user = await User.findById(req.users.user._id);
    const groupnames=[]
    for(var i=0; i<user.groups.length;i++){
        const group = await Group.findById(user.groups[i].group)
        groupnames.push(group.groupname);
    }
    res.status(200).send({username:req.users.user.username,groupnames});
});
app.post('/api/create_group',auth,async(req,res)=>{
    try{
        if(req.users.user.username==req.body.username1||req.users.user.username==req.body.username2||req.users.user.username==req.body.username3||req.body.username1==req.body.username2||req.body.username1==req.body.username3||req.body.username2==req.body.username3){
            throw new Error();
        }
        var contributors=[];
    var members=[];
    var councilOfLeaders=[];
    const id =mongoose.Types.ObjectId();
    var user = await User.findById(req.users.user._id);
    user.groups.push({
        group:id,
        contributions:0
    })
    contributors.push({
        contributor:req.users.user._id
    })
    members.push({
        member:req.users.user._id
    })
    var user1 = await User.findOne({username:req.body.username1})
    user1.groups.push({
        group:id,
        contribution:0
    })
    councilOfLeaders.push({
        leader:user1._id,
        contributions:0
    })
    contributors.push({
        contributor:user1._id
    });
    members.push({
        member:user1._id
    })
    var user2 = await User.findOne({username:req.body.username2});
    user2.groups.push({
        group:id,
        contribution:0
    })
    councilOfLeaders.push({
        leader:user2._id,
        contributions:0
    })
    contributors.push({
        contributor:user2._id
    });
    members.push({
        member:user2._id
    });
    var user3 = await User.findOne({username:req.body.username3})
    user3.groups.push({
        group:id,
        contribution:0
    })
    councilOfLeaders.push({
        leader:user3._id,
        contributions:0
    })
    contributors.push({
        contributor:user3._id
    });
    members.push({
        member:user3._id
    });
    try{const group = new Group({
        _id:id,
        groupname:req.body.groupname,
        leader:req.users.user._id,
        contributors:contributors,
        councilOfLeaders:councilOfLeaders,
        members:members,
        noOfContributions:0
    });
    groupSearch.push(group);
    await group.save();
    await user1.save()
    await user2.save()
    await user3.save()
    await user.save()
    res.status(200).send()
   }catch(e){
    console.log(e);
    res.status(400).send(e)
   } 
}catch(e){
    console.log(e);
    res.status(400).send({error:'error while submit request'})
}
})

app.get('/api/profile/:username/request',auth,async(req,res)=>{
    //################to set the follow requests#################
    const user = await User.findOne({username:req.params.username});
    const user1 = await User.findOne({username:req.users.user.username,_id:req.users.user._id})
    user.requests.push({
        request:user1._id
    });
    user1.requestedUser.push({
        request:user._id
    });
    await user.save()
    await user1.save();
    res.status(200).send({requested:true,username:req.users.user.username})
})

app.get('/api/profile/user/:username/:request/:choice',auth,async(req,res)=>{
    const user = await User.findOne({username:req.params.username});
    const user1 = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    var user2 = await User.findById(req.params.request);
    if(user.username == user1.username){
        for( var i=0;i<user.requests.length;i++){
            if(user.requests[i].request.toString() == req.params.request.toString()){
                if(req.params.choice == 'accept'){
                    user.followers.push({
                        follower:req.params.request
                    });
                    
                    user.requests.splice(i,1);
                    for(var j =0 ;j<user2.requestedUser.length;j++){
                        if(user._id.toString() == user2.requestedUser[j].request.toString()){
                            user2.requestedUser.splice(j,1);
                            user2.following.push({
                                follow:user._id
                            });
                            break;
                        }
                    }
                }else{
                    user.requests.splice(i,1);
                    for(var j =0 ;j<user2.requestedUser.length;j++){
                        if(user._id.toString() == user2.requestedUser[j].request.toString()){
                            user2.requestedUser.splice(j,1);
                            
                            break;
                        }
                    }
                }
             break;   
            }
        }
        await user2.save();
        await user.save();
        res.status(200).send({requests:user.requests})
    }else{
        res.status(403).send({error:'error'})
    }
})

app.get('/api/profile/user/:username/requests',auth,async(req,res)=>{
    //##################to see the follow requests###################
    try{
        if(req.users.user.username==req.params.username){
        const user = await User.findOne({username:req.params.username});
        const requests=[];
        for(var i=0;i<user.requests.length;i++){
            const u = await User.findById(user.requests[i].request)
            requests.push({
                request:`${u.username} wants to follow you`,
                id:u._id
            })
        }
        // var ut={
        //     username:req.users.user.username,
        // }
        res.status(200).send({user:req.users.user.username,requests})
    }}catch(e){
        console.log(e)
        res.status(403).send({error:e})
    }
})

app.get('/api/profile/:username/:post/comments',auth,async(req,res)=>{
    try{var k=0;
    const user1 = await  User.findOne({username:req.params.username});
    const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    if(req.users.user.username == req.params.username){
        k=1;
    }    
    if(k!=1){
        for(var i=0;i<user.following.length;i++){
            if(user.following[i].follow.toString()==user1._id.toString()){
                k=1;
                break;
            }
        }
    }
    if(k==1){
        var comments=[]
        var post = await Post.findById(req.params.post)
        for(var i=0;i<post.comments.length;i++){
            var user2= await User.findById(post.comments[i].writer);
            comments.push({
                comment:post.comments[i].comment,
                writer:user2.username,
                applause:post.comments[i].applause,
                _id:post.comments[i]._id,
                applaused:'applause'
            })
            for(var j=0;j<post.comments[i].applausedBy.length;j++){
                if(post.comments[i].applausedBy[j].applause.toString()==req.users.user._id.toString()){
                    comments[i].applaused='applaused'
                    j=post.comments[i].applausedBy.lenght;
                }
            }
        }
        var data={
            comments,
            post:post.post,
            applause:post.applause,
            owner:req.params.username
        }
        var groupnames=[];
        for(var i=0;i<user.groups.length;i++){
            const group = await Group.findById(user.groups[i].group);
            groupnames.push(group.groupname)
        }
        data.groupnames=groupnames;
        res.status(200).send({data,username:req.users.user.username});
    }else{
        throw new Error();
    }

}catch(e){
    res.send(403).send()
}
})

app.get('/api/:username/post/:post/increase',auth,async(req,res)=>{
    var user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    const user1 = await User.findOne({username:req.params.username})
    const post=await Post.findById(req.params.post);
    var k=0;
    if(req.params.username == user.username){
        k=1;
    }if(k!=1){
    for(var i=0;i<user.following.length;i++){
        if(user1._id.toString()==user.following[i].follow.toString()){
            k=1;
            if(!user.following[i].applaused){
                user.following[i].applaused=0;
            }
            user.following[i].applaused+=1;
            break;
        }
    }
    }
    if(k==1){
    post.applause+=1;
    post.applausedBy.push({
        applause:req.users.user._id
    })
    await user.save();
    await post.save();
    res.status(200).send({ok:true})
}else{
    res.status(400).send({ok:false})
}
})

app.post('/api/profile/:username/:post/comments',auth,async(req,res)=>{
    try{
        var k=0;
        const user1 = await User.findOne({username:req.params.username})
        const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id})
        if(user1.username==user.username){
            k=1;
        }if(k!=1){
        for(var i =0;i<user.following.length;i++){
            if(user.following[i].follow.toString() == user1._id.toString()){
                k=1;
                break;
            }
        }}if(k==1){
    var post  = await Post.findById(req.params.post);
    post.comments.push({
        comment:req.body.comment,
        applause:0,
        writer:req.users.user._id
    })
    if(req.users.user.username != req.params.username){
        for(var i=0;i<user.following.length;i++){
            if(user.following[i].follow.toString()==user1._id.toString()){
                if(!user.following[i].commented){
                    user.following[i].commented=0
                }
                user.following[i].commented+=1;
                break;
            }
        }
    }
    await user.save();
    await post.save();
    res.status(200).send({done:true})
   }else{
       throw new Error();
   }
}catch(e){
    res.status(403).send({error:true})
}
})

app.get('/api/profile/:username/:post/:comment/increase',auth,async(req,res)=>{
    const user = await User.findOne({username:req.params.username});
    const user1 = await User.findOne({username:req.users.user.username,_id:req.users.user._id})
    const post = await Post.findById(req.params.post);
    var k=0;
    if(req.users.user._id.toString()==user._id.toString()){
        k=1;
    }else{
        for(var i=0;i<user1.following.length;i++){
            if(user1.following[i].follow.toString()==user._id.toString()){
                k=1;
                if(!user1.following[i].applaused){
                    user1.following[i].applaused=0;
                }
                user1.following[i].applaused+=1;
                break;
            }
        }
    }
    if(k==1){
        for(var i=0;i<post.comments.length;i++){
            if(post.comments[i]._id.toString()==req.params.comment.toString()){
                post.comments[i].applause+=1;
                post.comments[i].applausedBy.push({
                applause:req.users.user._id
                });
                await user1.save();
                await post.save();
                res.status(200).send({ok:true});
            }
        }
    }else{
        res.status(403).send({ok:false});
    }
})

app.post('/api/home',auth,async(req,res)=>{
    const user =await User.findOne({username:req.users.user.username})
    var posts =[];
    var groupnames=[];
    var limit=req.body.limit;
    var notLessThan =req.body.notLessThan;
    const date = new Date(Date.now()-(24*60*60*1000)*limit)
    const date1 = new Date(Date.now()-(24*60*60*1000)*(limit-1))

    for(var i=0;i<user.following.length;i++){
        var user1 = await User.findById(user.following[i].follow);
        await user1.populate({
            path:'post',
            match:{
                timestamp:{
                    $gte:date,
                    $lt:date1
                }
            }
        }).execPopulate();
    for(var j=0;j<user1.post.length;j++){
        posts.push({
            username:user1.username,
            _id:user1.post[j]._id,
            post:user1.post[j].post,
            applaused:'applause',
            applause:user1.post[j].applause
        });
        for(var k=0;k<user1.post[j].applausedBy.length;k++){
            if(user1.post[j].applausedBy[k].applause.toString()==req.users.user._id.toString()){
                posts[j].applaused='applaused';
                k=user1.post[j].applausedBy.length;
            }
        }
    }
    }
    for(var i=0;i<user.groups.length;i++){
        var group = await Group.findById(user.groups[i].group);
        groupnames.push(group.groupname);
        await group.populate({
            path:'contributions',
            match:{
                timestamp:{
                    $gte:date,
                    $lt:date1
                }
            },options:{
                sort:{
                    timestamp:-1
                }
            }
        }).execPopulate();
        var length = posts.length;
        for(var j=0;j<group.contributions.length;j++){
            var user1 = await User.findById(group.contributions[j].owner);
            posts.push({
                _id:group.contributions[j]._id,
                post:group.contributions[j].post,
                contributor:user1.username,
                applaused:'applause',
                applause:group.contributions[j].applause,
                groupname:group.groupname
            })
            for(var k=0;k<group.contributions[j].applausedBy.length;k++){
                if(group.contributions[j].applausedBy[k].applause==req.users.user._id){
                    posts[j+length].applaused='applaused';
                    k=group.contributions[j].applausedBy.length;
                }
            }
        }
    }
    res.status(200).send({username:req.users.user.username,posts,groupnames})
})

app.get('/api/search',auth,async(req,res)=>{
    res.status(200).send({username:req.users.user.username})
})
app.get('/api/profile/:username/followers',auth,async(req,res)=>{
    try{const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    const user1 = await User.findOne({username:req.params.username});
    var k=0;
    if(user1.username==user.username){
        k=1;
    }
    if(k!=1){
        for(var i=0;i<user.following.length;i++){
            if(user.following[i].follow.toString()==user1._id.toString()){
                k=1;
                break;            
            }
        }
    }
    const usernames=[];
    if(k==1){
        for(var i=0;i<user1.followers.length;i++){
            var user2 = await User.findById(user1.followers[i].follower);
            usernames.push(user2.username);
        }
        res.status(200).send({usernames,username:req.users.user.username});
    }else{
        throw new Error();
    }
}catch(e){
    res.status(403).send(e);
}
})
app.get('/api/profile/:username/groups',auth,async(req,res)=>{
    try{const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    const user1 = await User.findOne({username:req.params.username});
    var k=0;
    if(user1.username==user.username){
        k=1;
    }
    if(k!=1){
        for(var i=0;i<user.following.length;i++){
            if(user.following[i].follow.toString()==user1._id.toString()){
                k=1;
                break;            
            }
        }
    }
    const groupnames=[];
    if(k==1){
        for(var i=0;i<user1.groups.length;i++){
            var group = await Group.findById(user1.groups[i].group);
            groupnames.push(group.groupname);
        }
        res.status(200).send({groupnames,username:req.users.user.username});
    }else{
        throw new Error();
    }
}catch(e){
    res.status(403).send(e);
}
})

app.get('/api/profile/:username/following',auth,async(req,res)=>{
    console.log("kokokok");
    try{const user = await User.findOne({username:req.users.user.username,_id:req.users.user._id});
    const user1 = await User.findOne({username:req.params.username});
    var k=0;
    if(user1.username==user.username){
        k=1;
        console.log("k");
    }
    if(k!=1){
        for(var i=0;i<user.following.length;i++){
            if(user.following[i].follow.toString()==user1._id.toString()){
                k=1;
                break;            
            }
        }
    }
    const usernames=[];
    if(k==1){
        console.log("okokok");
        for(var i=0;i<user1.following.length;i++){
            console.log(i);
            var user2 = await User.findById(user1.following[i].follow);
            console.log(user2.username);
            usernames.push(user2.username);
            console.log(usernames);
            res.status(200).send({usernames,username:req.users.user.username});
        }
    }else{
        throw new Error();
    }
}catch(e){
    console.log("okokoko");
    res.status(403).send(e);
}
})

app.get('/api/profile/:username',auth,async (req,res)=>{
    const user = await User.findOne({username:req.params.username});
    const user1 = await User.findOne({username:req.users.user.username,_id:req.users.user._id})
    var k=0;
    if(user.username==user1.username){
        k=1;
    }else{
    for(var i =0;i<user1.following.length;i++){
        if(user1.following[i].follow.toString() == user._id.toString()){
            k=1;
        }
    }
    }if(k==1){
    await user.populate({
        path:'post',
        options:{
            sort:{
                timestamp: -1
            }
        }}).execPopulate();
        var userk={
            username:user.username,
            followers:user.followers.length,
            following:user.following.length,
            members:user.groups.length,
            contributions:user.contributions
        }
        var postk =[];
        if(user.username==user1.username){
            userk.himself=true
            userk.requests = user.requests.length.toString()
        }
        for(var j=0;j<user.post.length;j++){
            postk[j]={
                _id:user.post[j]._id,
                post :user.post[j].post,
                owner:user.post[j].owner,
                applause:user.post[j].applause,
                applaused:'applause'
            }
            if(user.post[j].applausedBy){
            for(var i=0;i<user.post[j].applausedBy.length;i++){
                if(user.post[j].applausedBy[i].applause.toString()==user1._id.toString()){
                    postk[j].applaused = "applaused";
                    i=user.post[j].applausedBy.length;
                }
        }}}
        var groupnames=[];
        for(var i=0; i<user1.groups.length;i++){
            var group = await Group.findById(user1.groups[i].group);
            groupnames.push(group.groupname)
        }
    const data={user:userk,post:postk,groupnames,username:req.users.user.username}
    res.status(200).send(data)
    }else{
        var request='request';
        var userk={
            username:user.username,
            followers:user.followers.length,
            following:user.following.length,
            members:user.groups.length,
            contributions:user.contributions
        }
        for(var i=0;i<user1.requestedUser.length;i++){
            if(user1.requestedUser[i].request.toString()==user._id){
                request='requested'
            }
        }
        var groupnames=[];
        for(var i=0; i<user1.groups.length;i++){
            var group = await Group.findById(user1.groups[i].group);
            groupnames.push(group.groupname)
        }
        res.status(200).send({user:userk,request,groupnames,username:req.users.user.username})
    }
    //**************************************************ALGO FOR SHOWING HOME *******************************/
});


io.on('connection',(socket)=>{
    socket.on('Searchuser',(username)=>{
        var usek=[]
        for(var i=0;i<userSearch.length;i++){
            if(userSearch[i].username.includes(username)){
                usek.push(userSearch[i].username);
            }
        }
        socket.emit('searchUser',usek);
    });
    socket.on('Searchgroup',(groupname)=>{
        var grouk=[];
        for(var i=0;i<groupSearch.length;i++){
            if(groupSearch[i].groupname.includes(groupname)){
                grouk.push(groupSearch[i].groupname);
            }
        }
        socket.emit('searchGroup',grouk)
    })
})

var port = process.env.PORT||'3001'

server.listen(port,()=>{
    console.log("on");
});




// const user = new User({
//     username:"anikettyyagi",
//     password:"123456",
//     email:"anikettyagi13@gmail.com"
// });
// await user.save();
// var u = await User.findOne({username:"anikettyyagi"});
// console.log(u);
// const post = new Post({
//     post:"hello my \\\\\ aniket",
//     applause:0,
//     owner:u._id
// });
// await post.save();
// var u = await User.findOne({username:"anikettyyagi"});
// await u.populate('post').execPopulate();
// await u.save();
// console.log(u.post);
// // JSON.stringify(u);
// const v={
//     user:u,
//     post:u.post
// }