import { Link } from "react-router-dom";
import { getDay } from "../common/date";
import axios from "axios"
import { useContext } from "react";
import { UserContext } from "../App";


const NotificationCard = ({ data, index, notificationState }) => {
    let { seen, type, createdAt, comment, user: { personal_info: { fullname, username, profile_img } } , blog:{ blog_id, title } } = data;
    let {userAuth: { access_token }} = useContext(UserContext);
    let { notifications, notifications: { results, totalDocs }, setNotifications } = notificationState;

    

    return(
        <div className={"p-6 border-b border-grey border-l-black "+ (!seen?"border-l-2":"")}>
            <div className="flex gap-5 mb-3">
                <img src={profile_img} className="w-14 h-14 flex-none rounded-full" />
                <div className="w-full">
                    <h1 className="font-medium text-xl text-dark-grey">
                        <span className="lg:inline-block hidden capitalize">{fullname}</span>
                        <Link to={`/user/${username}`} className="mx-1 text-black underline" >@{username}</Link>
                        <span className="font-normal">
                            {
                                type =='like' ? "Liked your blog" :
                                "Commented on"
                            }
                        </span>
                    </h1>
                    {
                        <Link to={`/blog/${blog_id}`} className="font-medium text-dark-grey hover:underline line-clamp-1">{`"${title}"`}</Link>
                    }
                </div>
            </div>

            {
                type!='like' ?
                <p className="ml-14 pl-5 font-gelasio text-xl my-5">{comment.comment}</p> 
                : ""
            }
            <div className="ml-14 pl-5 mt-3 text-dark-grey flex gap-8">
                <p>{getDay(createdAt)}</p>
            </div>
        </div>
    )
}

export default NotificationCard;