import { useContext } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { UserContext } from "../App";

const SideNav = () => {
    let { userAuth: { access_token } } = useContext(UserContext);
    return (
        access_token===null?<Navigate to="/signin" />:
        <>
            <section className="relative flex gap-10 py-0 m-0 max-md:flex-col">
                <div className="sticky top-[80px] z-30">
                    <div className="min-w-[200px] h-cover md:sticky top-24 overflow-y-auto p-6 md:pr-0">
                        <h1 className="text-xl text-dark-grey mb-3">Dashboard</h1>
                        <hr className="border-grey -ml-6 mb-8 mr-6"/>

                        <NavLink to="/dashboard/blogs"></NavLink>

                    </div>
                </div>
            </section>
            

            <Outlet/>
        </>
    )
}

export default SideNav;