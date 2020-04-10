const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
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
        required:true
    },
    group:{
        ref:'Group',
        type:mongoose.Schema.Types.ObjectId,
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
        },
        applause:{
            type:Number
        },
        writer:{
            type:mongoose.Schema.Types.ObjectId
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
})

const Contribution = mongoose.model('Contribution',contributionSchema);

module.exports = Contribution;