const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    post:{
        type:String,
        required:true
    },
    applause:{
        type:Number,
        required:true
    },
    owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    applausedBy:[{
        applause:{
            type:mongoose.Schema.Types.ObjectId
        }
    }],
    comments:[{
        comment:{
            type:String,
            trim:true
        },writer:{
            type:mongoose.Schema.Types.ObjectId
        },
        applause:{
            type:Number
        },
        applausedBy:[{
            applause:{
                type:mongoose.Schema.Types.ObjectId
            }
        }],
        timestamp:{
            type:Date,
            default:Date.now
        }
    }],
    timestamp:{
        type:Date,
        default:Date.now
    }
});

const Post = mongoose.model("Post",postSchema);

module.exports = Post;