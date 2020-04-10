const mongoose = require('mongoose');
const post = require('./post');

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        lowercase:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
        validate(value){
            if(value.length<6){
                throw new Error('password should have atleast 6 characters')
            }
        }
    },
    email:{
        type:String,
        unique:true,
        required:true
    },
    groups:[{
        group:{
            type:mongoose.Schema.Types.ObjectId
        },contribution:{
            type:Number
        },applaused:{
            type:Number
        },commented:{
            type:Number
        }
    }],
    contributions:{
        type:Number
    },
    followers:[{
        follower:{
            type:mongoose.Schema.Types.ObjectId
        }
    }],
    following:[{
        follow:{
            type:mongoose.Schema.Types.ObjectId
        },applaused:{
            type:Number
        },commented:{
            type:Number
        }
    }],
    requests:[{
        request:{
            type:mongoose.Schema.Types.ObjectId
        }
    }],
    requested:[{
        request:{
            type:mongoose.Schema.Types.ObjectId
        }
    }],
    requestedUser:[{
        request:{
            type:mongoose.Schema.Types.ObjectId
        }
    }]
});

userSchema.virtual("post",{
    ref:'Post',
    localField:'_id',
    foreignField:'owner'
})

const User = mongoose.model("User",userSchema);

module.exports= User;