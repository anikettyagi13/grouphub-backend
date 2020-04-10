const mongoose = require('mongoose');
const Contribution  = require('./contribution');
const groupSchema = new mongoose.Schema({
    groupname:{
        type:String,
        required:true,
        unique:true
    },leader:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    councilOfLeaders:[{
        leader:{
            type:mongoose.Schema.Types.ObjectId,
            required:true
        },
        contributions:{
            type:Number,
            required:true
        }
    }],
    noOfContributions:{
        type:Number
    },
    contributors:[{
        contributor:{
            type:mongoose.Schema.Types.ObjectId,
            required:true
        }
    }],
    members:[{
        member:{
            type:mongoose.Schema.Types.ObjectId,
            required:true
        }
    }],
    notifications:[{
        notification:{
            type:String,
            trim:true
        },
        contributor:{
            type:mongoose.Schema.Types.ObjectId
        }
    }],
    requests:[{
        request:{
            type:mongoose.Schema.Types.ObjectId
        }
    }]
});

groupSchema.virtual('contributions',{
    ref:'Contribution',
    localField:'_id',
    foreignField:'group'
});

const Group = mongoose.model('Group',groupSchema);

module.exports = Group;