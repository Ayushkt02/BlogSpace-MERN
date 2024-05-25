import axios from "axios"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { app } from "../common/firebase";


const storage = getStorage(app);


const UploadImage = async (img) => {
    
    const name = new Date().getTime() + img.name;
    const storageRef = ref(storage, name);

    await uploadBytesResumable(storageRef, img);
    return getDownloadURL(storageRef);

}

export default UploadImage;