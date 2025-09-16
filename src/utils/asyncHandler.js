//using promises .then .catch

// const asyncHandler = (requestHandler)=>{
//     (req,res,next)=>{
//         Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
//     }
// }

// export {asyncHandler}




// const asyncHandler = ()=>{}
// const asyncHandler = (fn)=>()=> {}
// const asyncHandler = (fn)=>async()=> {}


//how this below function is using try catch
const asyncHandler = (fn) => async (req,res,next) => {
    try {
        await fn(req,res,next)
    } catch (error) {
        res.status(error.code || 500).json({
            success : false,
            message : error.message
        })
    }
}



export {asyncHandler}