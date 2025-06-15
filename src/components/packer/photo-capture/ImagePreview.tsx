
interface ImagePreviewProps {
    image: string;
}

const ImagePreview = ({ image }: ImagePreviewProps) => {
    return (
        <div className="w-full max-w-2xl bg-black rounded-lg overflow-hidden">
            <img src={image} alt="Captured produce" className="w-full h-auto"/>
        </div>
    );
};

export default ImagePreview;
